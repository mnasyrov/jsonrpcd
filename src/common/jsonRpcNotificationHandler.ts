import {JsonRpcMessageParams} from '@mnt-libs/jsonrpc/src/common/jsonRpcTypes';

export type JsonRpcNotificationHandler = (
  params: JsonRpcMessageParams | null,
) => any;
