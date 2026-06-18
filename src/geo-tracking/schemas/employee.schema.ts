import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'employees', timestamps: true })
export class Employee extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  name: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
