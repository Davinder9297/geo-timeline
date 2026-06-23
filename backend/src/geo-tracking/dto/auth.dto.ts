import { IsString, IsNotEmpty, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../schemas/employee.schema';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateEmployeeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
