import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Employee, UserRole } from './schemas/employee.schema';
import { LoginDto, CreateEmployeeDto } from './dto/auth.dto';

export interface EmployeeResponse {
  companyId: string;
  employeeId: string;
  name: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
    private jwtService: JwtService,
  ) {}

  async register(createEmployeeDto: CreateEmployeeDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    const existingEmployee = await this.employeeModel.findOne({
      companyId: createEmployeeDto.companyId,
      employeeId: createEmployeeDto.employeeId,
    });

    if (existingEmployee) {
      throw new ConflictException('Employee already exists');
    }

    const passwordHash = await bcrypt.hash(createEmployeeDto.password, 10);

    const employee = new this.employeeModel({
      ...createEmployeeDto,
      passwordHash,
      role: createEmployeeDto.role || UserRole.EMPLOYEE,
    });
    await employee.save();

    const payload = {
      employeeId: employee.employeeId,
      companyId: employee.companyId,
      role: employee.role,
    };

    const { passwordHash: _, ...employeeWithoutPassword } = employee.toObject();

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '7d',
      }),
      employee: {
        companyId: employeeWithoutPassword.companyId,
        employeeId: employeeWithoutPassword.employeeId,
        name: employeeWithoutPassword.name,
        role: employeeWithoutPassword.role,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    const employee = await this.employeeModel.findOne({
      companyId: loginDto.companyId,
      employeeId: loginDto.employeeId,
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      employee.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      employeeId: employee.employeeId,
      companyId: employee.companyId,
      role: employee.role,
    };

    const { passwordHash: _, ...employeeWithoutPassword } = employee.toObject();

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '7d',
      }),
      employee: {
        companyId: employeeWithoutPassword.companyId,
        employeeId: employeeWithoutPassword.employeeId,
        name: employeeWithoutPassword.name,
        role: employeeWithoutPassword.role,
      },
    };
  }
}
