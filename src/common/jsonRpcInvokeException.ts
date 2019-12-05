import {Exception, ExceptionCause} from '@mnt-libs/stdlib/src/exception';

export class JsonRpcInvocationException extends Exception {
  constructor(message: string, cause?: ExceptionCause) {
    super(message, cause);
    this.name = 'JsonRpcInvocationException';
  }
}
