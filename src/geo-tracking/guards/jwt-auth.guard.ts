import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface AuthenticatedUser {
  employeeId: string;
  companyId: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    request.user = {
      employeeId: 'test-employee-id',
      companyId: 'test-company-id',
      role: 'EMPLOYEE',
    } as AuthenticatedUser;
    return true;
  }
}
