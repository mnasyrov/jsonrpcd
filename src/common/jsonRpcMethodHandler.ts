import {JsonRpcMessageParams} from '@mnt-libs/jsonrpc/src/common/jsonRpcTypes';
import {JsonRpcMethodResponse} from '@mnt-libs/jsonrpc/src/common/jsonRpcMethodResponse';

export type JsonRpcMethodHandler = (params: JsonRpcMessageParams | null, response: JsonRpcMethodResponse) => Promise<any>;
