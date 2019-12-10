// JSON-RPC 2.0 Specification
// http://www.jsonrpc.org/specification

export type JsonRpcMessageId = string | number;
export type JsonRpcMessageParams = any[] | object;

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: JsonRpcMessageId | null;
  method?: string;
  params?: JsonRpcMessageParams;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: JsonRpcMessageParams;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcMessageId | null;
  method: string;
  params?: JsonRpcMessageParams;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcMessageId | null;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: JsonRpcErrorCode | number;
  message: string;
  data?: any;
}

export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}
