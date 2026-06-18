import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

@Schema({ collection: 'employees', timestamps: true })
export class Employee extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true, unique: true })
  employeeId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
