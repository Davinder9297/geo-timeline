import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedUser } from './jwt-auth.guard';

@Injectable()
export class CompanyIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    const companyIdParam = request.params.companyId;

    if (!user || user.companyId !== companyIdParam) {
      throw new ForbiddenException('Cross-company access is forbidden');
    }

    return true;
  }
}
