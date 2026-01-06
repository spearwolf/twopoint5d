import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {voBuffer, voIndex} from './constants.js';
import type {VO} from './types.js';

export class VOUtils {
  static set(vo: VO, buffer: VertexObjectBuffer, bufferIndex: number): VO {
    vo[voBuffer] = buffer;
    vo[voIndex] = bufferIndex;
    return vo;
  }

  static setIndex(vo: VO, bufferIndex: number): VO {
    vo[voIndex] = bufferIndex;
    return vo;
  }

  static getIndex(vo: VO): number {
    return vo[voIndex];
  }

  static getBuffer(vo: VO): VertexObjectBuffer | undefined {
    return vo[voBuffer];
  }

  static isBuffer(vo: VO, buffer: VertexObjectBuffer | undefined): boolean {
    return vo[voBuffer] === buffer;
  }

  static hasBuffer(vo: VO): boolean {
    return vo[voBuffer] != null;
  }

  static setBuffer(vo: VO, buffer: VertexObjectBuffer | undefined): VO {
    vo[voBuffer] = buffer;
    return vo;
  }

  static clearBuffer(vo: VO): VO {
    vo[voBuffer] = undefined;
    return vo;
  }
}
