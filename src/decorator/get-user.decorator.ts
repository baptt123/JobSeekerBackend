// src/auth/get-user.decorator.ts
//Custom decorator for firebase strategy authentication
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DecodedIdToken => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = ctx.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
    return request.user;
  },
);
