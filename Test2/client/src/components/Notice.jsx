export default function Notice({message,type='error'}){return message?<div className={`notice ${type}`}>{message}</div>:null}
