import '@fastify/jwt';
import 'fastify';

export interface JwtPayload {
  sub: string;
  role: 'member' | 'platform_admin';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
  }
}
