import { describe, it, expect } from '@jest/globals';
import { requestContext, getRequestContext } from '../../../../src/common/context/request-context';

describe('RequestContext', () => {
  it('should store and retrieve context', () => {
    const context = { requestId: '123', correlationId: 'abc' };
    requestContext.run(context, () => {
      expect(getRequestContext()).toEqual(context);
    });
  });

  it('should return empty object if no context', () => {
    expect(getRequestContext()).toEqual({});
  });
});
