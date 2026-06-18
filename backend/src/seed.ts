import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Employee, UserRole, EmployeeSchema } from './geo-tracking/schemas/employee.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/geo-timeline'),
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
  ],
})
class SeedModule {}

async function seed() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const employeeModel = app.get<Model<Employee>>(getModelToken(Employee.name));

  console.log('Seeding database...');

  // Clear existing data (optional)
  await employeeModel.deleteMany({});

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = new employeeModel({
    companyId: 'acme-corp',
    employeeId: 'admin',
    name: 'System Admin',
    passwordHash: adminPasswordHash,
    role: UserRole.ADMIN,
  });
  await admin.save();
  console.log('Created admin: employeeId=admin, password=admin123');

  // Create manager user
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const manager = new employeeModel({
    companyId: 'acme-corp',
    employeeId: 'manager1',
    name: 'John Manager',
    passwordHash: managerPasswordHash,
    role: UserRole.MANAGER,
  });
  await manager.save();
  console.log('Created manager: employeeId=manager1, password=manager123');

  // Create employee users
  const employeePasswordHash = await bcrypt.hash('employee123', 10);

  const employee1 = new employeeModel({
    companyId: 'acme-corp',
    employeeId: 'emp-001',
    name: 'Alice Smith',
    passwordHash: employeePasswordHash,
    role: UserRole.EMPLOYEE,
  });
  await employee1.save();
  console.log('Created employee: employeeId=emp-001, password=employee123');

  const employee2 = new employeeModel({
    companyId: 'acme-corp',
    employeeId: 'emp-002',
    name: 'Bob Johnson',
    passwordHash: employeePasswordHash,
    role: UserRole.EMPLOYEE,
  });
  await employee2.save();
  console.log('Created employee: employeeId=emp-002, password=employee123');

  console.log('Seeding complete!');
  await app.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
