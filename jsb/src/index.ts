import { JSB } from "./jsb";

export { JSBError } from "./error";
export { JSB } from "./jsb";
export type {
  JSBEmitMessage,
  JSBErrorPayload,
  JSBEventListener,
  JSBEventMeta,
  JSBIncomingMessage,
  JSBInvokeRequestMessage,
  JSBInvokeResponseMessage,
  JSBInvokeResponseMessageError,
  JSBInvokeResponseMessageSuccess,
  JSBPort,
  JSBPortMessageEvent,
  JSBPortMessageListener,
} from "./types";

export default new JSB();
