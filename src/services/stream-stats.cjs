"use strict";

const positiveNumber=value=>{
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:0;
};
const identifier=value=>value!==undefined&&value!==null&&String(value)!=="0"?String(value):"";

// Session totals must outlive the bounded event feed shown in the overlay.
class StreamStats {
  constructor(){this.reset();}
  reset(){this.likeCount=0;this.gifters=new Map();this.seen=new Set();}

  duplicate(key){
    if(!key)return false;
    if(this.seen.has(key))return true;
    this.seen.add(key);
    // Bound replay protection separately from the lifetime totals.
    if(this.seen.size>10000)this.seen.delete(this.seen.values().next().value);
    return false;
  }

  ingest(event={}){
    const kind=event.eventType||event.type;
    if(kind!=="like"&&kind!=="gift"&&!event.gift)return;
    const metadata=event.metadata||event.data||{};
    const platform=String(event.platform||"tiktok");
    const roomId=identifier(metadata.common?.roomId||metadata.roomId||metadata.room_id);
    const messageId=identifier(metadata.common?.msgId||metadata.msgId||event.commentMsgId||event.id);

    if(kind==="like"){
      const count=positiveNumber(event.metrics?.likeCount??event.likeCount??metadata.likeCount??metadata.like_count??event.value);
      if(count&&!this.duplicate(messageId?JSON.stringify([platform,roomId,"like",messageId]):""))this.likeCount+=count;
      return;
    }

    const gift=event.gift||metadata.gift||event;
    const repeatEnd=gift.repeatEnd??gift.repeat_end??metadata.repeatEnd;
    const giftType=Number(gift.giftType??gift.gift_type??metadata.giftType??metadata.giftDetails?.giftType??(repeatEnd!==undefined?1:0));
    // TikTok emits cumulative progress updates and then the final count again.
    // Only that final event contributes to totals for streakable gifts.
    if(giftType===1&&repeatEnd!==true&&repeatEnd!==1&&repeatEnd!=="1"&&repeatEnd!=="true")return;

    const diamonds=positiveNumber(gift.diamondCount??gift.diamond_count??event.diamondCount);
    const repeats=positiveNumber(gift.repeatCount??gift.repeat_count??event.repeatCount??1);
    const total=diamonds*repeats||positiveNumber(gift.totalDiamonds);
    if(!total)return;
    const userId=identifier(event.userId||metadata.user?.userId||metadata.userId);
    const username=String(event.username||metadata.user?.uniqueId||event.displayName||event.name||"Unbekannt");
    const displayName=String(event.displayName||username);
    const sender=userId||username;
    const groupId=identifier(gift.groupId||metadata.groupId||metadata.group_id);
    const key=giftType===1&&groupId
      ?JSON.stringify([platform,roomId,"streak",sender,gift.giftId||gift.id||0,groupId])
      :messageId?JSON.stringify([platform,roomId,"gift",messageId]):"";
    if(this.duplicate(key))return;
    const senderKey=JSON.stringify([platform,sender]);
    const old=this.gifters.get(senderKey);
    this.gifters.set(senderKey,{platform,userId,username,displayName,totalDiamonds:(old?.totalDiamonds||0)+total});
  }

  snapshot(){
    return{
      likeCount:this.likeCount,
      topGifters:[...this.gifters.values()].sort((a,b)=>b.totalDiamonds-a.totalDiamonds).slice(0,5).map(value=>({...value}))
    };
  }
}

module.exports={StreamStats};
