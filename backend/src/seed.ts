import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import {
  Employee,
  UserRole,
  EmployeeSchema,
} from './geo-tracking/schemas/employee.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost/geo-timeline',
    ),
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
})
class SeedModule {}

async function seed() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const employeeModel = app.get<Model<Employee>>(getModelToken(Employee.name));

  console.log("Seeding database...");

  // Clear existing data (optional)
  await employeeModel.deleteMany({});

  // Create admin user for company1
  const adminPasswordHash = await bcrypt.hash("employee123", 10);
  const admin = new employeeModel({
    companyId: "company1",
    employeeId: "admin",
    name: "System Admin",
    passwordHash: adminPasswordHash,
    role: UserRole.ADMIN,
  });
  await admin.save();
  console.log("Created admin: employeeId=admin, password=employee123, company=company1");

  // Create manager user for company1
  const managerPasswordHash = await bcrypt.hash("employee123", 10);
  const manager = new employeeModel({
    companyId: "company1",
    employeeId: "manager1",
    name: "John Manager",
    passwordHash: managerPasswordHash,
    role: UserRole.MANAGER,
  });
  await manager.save();
  console.log("Created manager: employeeId=manager1, password=employee123, company=company1");

  // Create 10 employees for company1
  const employeePasswordHash = await bcrypt.hash("employee123", 10);
  const employeeNames = [
    "Alice Smith",
    "Bob Johnson",
    "Charlie Brown",
    "Diana Prince",
    "Ethan Hunt",
    "Fiona Gallagher",
    "George Miller",
    "Hannah Lee",
    "Ian Somerhalder",
    "Julia Roberts",
  ];

  for (let i = 0; i < 10; i++) {
    const employeeId = `emp-${String(i + 1).padStart(3, "0")}`;
    const employee = new employeeModel({
      companyId: "company1",
      employeeId,
      name: employeeNames[i],
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE,
    });
    await employee.save();
    console.log(`Created employee: employeeId=${employeeId}, password=employee123, company=company1`);
  }

  console.log("Seeding complete!");
  await app.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
