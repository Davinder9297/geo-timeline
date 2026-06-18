import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../schemas/employee.schema';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
