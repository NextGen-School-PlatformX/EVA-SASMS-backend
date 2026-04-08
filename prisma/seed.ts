import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting full system realization seeding...');

    // Clear existing data in correct order
    await prisma.attendanceRecord.deleteMany();
    await prisma.attendanceSession.deleteMany();
    await prisma.eventEnrollment.deleteMany();
    await prisma.supportMessage.deleteMany();
    await prisma.supportTicket.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.application.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.academicClass.deleteMany();
    await prisma.department.deleteMany();
    await prisma.academicYear.deleteMany();
    await prisma.user.deleteMany();
    await prisma.feeCategory.deleteMany();
    await prisma.event.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();

    const pw = await bcrypt.hash('Felopater', 10);

    // ─── 1. SuperAdmin ─────────────────────────────────
    const superAdmin = await prisma.user.create({
        data: {
            email: '0scar177771@gmail.com',
            password: pw,
            name: 'Oscar SuperAdmin',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
        },
    });
    console.log('✅ SuperAdmin created');

    // ─── 2. Academic Structure ─────────────────────────
    const yearNames = ['Junior', 'Wheeler', 'Senior'];
    const years: any[] = [];
    for (const name of yearNames) {
        const year = await prisma.academicYear.create({
            data: { name, isActive: true }
        });
        years.push(year);
    }
    console.log('✅ 3 Academic Years created');

    const deptsData = [
        { name: 'Software Development', icon: '💻', description: 'Coding and system architecture.' },
        { name: 'Operation & Maintenance (OM)', icon: '🛠️', description: 'Network and hardware management.' },
    ];

    const departments: any[] = [];
    for (const year of years) {
        for (const data of deptsData) {
            const dept = await prisma.department.create({
                data: {
                    ...data,
                    yearId: year.id
                }
            });
            departments.push(dept);
        }
    }
    console.log(`✅ ${departments.length} Hierarchical Departments created`);

    const classes: any[] = [];
    for (const dept of departments) {
        const classA = await prisma.academicClass.create({
            data: { name: 'Class A', departmentId: dept.id }
        });
        const classB = await prisma.academicClass.create({
            data: { name: 'Class B', departmentId: dept.id }
        });
        classes.push(classA, classB);
    }
    console.log(`✅ ${classes.length} Classes created across departments`);

    // ─── 3. Admins & Staff ─────────────────────────────
    const adminsData = [
        { email: 'admin.junior@sasms.edu', name: 'Dr. Sarah Junior', deptIdx: 0 }, // Junior Software
        { email: 'admin.senior@sasms.edu', name: 'Prof. Michael Senior', deptIdx: 4 }, // Senior Software
    ];

    for (const a of adminsData) {
        await prisma.user.create({
            data: {
                email: a.email, password: pw, name: a.name,
                role: 'ADMIN', status: 'ACTIVE', departmentId: departments[a.deptIdx].id,
                academicYearId: departments[a.deptIdx].yearId
            }
        });
    }

    const staffData = [
        { email: 'teacher.ali@sasms.edu', name: 'Ali Hassan', deptIdx: 0, position: 'C++ Instructor', isTeacher: true },
        { email: 'teacher.omar@sasms.edu', name: 'Omar Khalil', deptIdx: 1, position: 'Hardware Specialist', isTeacher: true },
    ];

    for (const s of staffData) {
        const user = await prisma.user.create({
            data: {
                email: s.email, password: pw, name: s.name,
                role: 'STAFF', status: 'ACTIVE', departmentId: departments[s.deptIdx].id,
                academicYearId: departments[s.deptIdx].yearId
            }
        });
        await prisma.staff.create({
            data: {
                userId: user.id, position: s.position, isTeacher: s.isTeacher,
                bio: `${s.name} is a dedicated professional at SASMS.`,
                rating: 4.8
            }
        });
    }
    console.log('✅ Admins and Staff created');

    // ─── 4. Students & Attendance ──────────────────────
    const studentData = [
        { email: 'student.ahmed@sasms.edu', name: 'Ahmed Tamer', classIdx: 0 }, // Junior Soft A
        { email: 'student.mona@sasms.edu', name: 'Mona Adel', classIdx: 0 },
        { email: 'student.youssef@sasms.edu', name: 'Youssef Khaled', classIdx: 8 }, // Senior Soft A
        { email: 'student.layla@sasms.edu', name: 'Layla Nabil', classIdx: 9 }, // Senior Soft B
    ];

    const students: any[] = [];
    const dates = [
        new Date('2024-02-19'),
        new Date('2024-02-20'),
        new Date('2024-02-21'),
        new Date('2024-02-22'),
        new Date('2024-02-23'),
    ];

    for (const s of studentData) {
        const cls = classes[s.classIdx];
        const dept = departments.find(d => d.id === cls.departmentId);
        const user = await prisma.user.create({
            data: {
                email: s.email, password: pw, name: s.name,
                role: 'STUDENT', status: 'ACTIVE',
                academicYearId: dept.yearId,
                departmentId: dept.id,
                classId: cls.id,
                studentClass: cls.name,
                admissionYear: years.find(y => y.id === dept.yearId).name
            }
        });
        students.push(user);
    }

    // Generate Attendance Sessions + Records
    for (const date of dates) {
        const sessionStart = new Date(date);
        sessionStart.setHours(8, 0, 0, 0);
        const sessionEnd = new Date(date);
        sessionEnd.setHours(10, 0, 0, 0);

        const session = await prisma.attendanceSession.create({
            data: {
                title: `Morning Session - ${date.toISOString().split('T')[0]}`,
                latitude: 30.0444,
                longitude: 31.2357,
                radius: 100,
                startTime: sessionStart,
                endTime: sessionEnd,
                createdBy: superAdmin.id,
            }
        });

        for (const student of students) {
            const isPresent = Math.random() > 0.1;
            await prisma.attendanceRecord.create({
                data: {
                    studentId: student.id,
                    sessionId: session.id,
                    status: isPresent ? 'PRESENT' : 'ABSENT',
                    scannedAt: isPresent ? new Date(sessionStart.getTime() + Math.random() * 3600000) : null,
                }
            });
        }
    }
    console.log('✅ Students created with Attendance history');

    // ─── 5. Applicants & Applications ──────────────────
    const applicantData = [
        { email: 'applicant.dina@gmail.com', name: 'Dina Fathy', deptIdx: 0 },
        { email: 'applicant.hassan@gmail.com', name: 'Hassan Wahba', deptIdx: 1 },
    ];

    for (const a of applicantData) {
        const user = await prisma.user.create({
            data: {
                email: a.email, password: pw, name: a.name,
                role: 'APPLICANT', status: 'PENDING'
            }
        });
        await prisma.application.create({
            data: {
                applicantId: user.id,
                status: 'PENDING',
                preferredDeptId: departments[a.deptIdx].id,
                selectionReason: 'Interested in technical innovation.'
            }
        });
    }
    console.log('✅ Applicants created');

    // ─── 6. Events & Enrollments ───────────────────────
    const events = [
        { title: 'Tech Symposium 2024', date: '2024-03-15', category: 'Academic', organizer: 'Oscar', capacity: 50 },
        { title: 'Spring Sports Festival', date: '2024-04-10', category: 'Sports', organizer: 'Student Council', capacity: 200 },
    ];

    for (const e of events) {
        const event = await prisma.event.create({ data: e });
        // Enroll half students in first event
        for (let i = 0; i < students.length / 2; i++) {
            await prisma.eventEnrollment.create({
                data: {
                    eventId: event.id,
                    userId: students[i].id
                }
            });
            await prisma.event.update({
                where: { id: event.id },
                data: { attendeesCount: { increment: 1 } }
            });
        }
    }
    console.log('✅ Events and Enrollments created');

    // ─── 7. Finances & Support ─────────────────────────
    const tuitionCat = await prisma.feeCategory.create({
        data: { name: 'Full Tuition 2024', amount: 15000, description: 'Annual fees' }
    });

    for (const student of students) {
        await prisma.transaction.create({
            data: {
                userId: student.id,
                amount: 15000,
                status: 'COMPLETED',
                type: 'PAYMENT',
                feeCategoryId: tuitionCat.id,
                reference: `INV-${student.id.slice(0, 4)}`
            }
        });

        const ticket = await prisma.supportTicket.create({
            data: {
                subject: 'Portal Access',
                category: 'Technical',
                applicantId: student.id,
                status: 'RESOLVED'
            }
        });
        await prisma.supportMessage.create({
            data: {
                ticketId: ticket.id,
                senderId: student.id,
                content: 'I cannot see my grades.',
                role: 'USER'
            }
        });
        await prisma.supportMessage.create({
            data: {
                ticketId: ticket.id,
                senderId: superAdmin.id,
                content: 'Grades will be released next week.',
                role: 'STAFF'
            }
        });
    }
    console.log('✅ Finance records and Support tickets created');

    // ─── 8. Notifications ──────────────────────────────
    await prisma.notification.create({
        data: {
            text: 'System upgrade scheduled for tonight.',
            type: 'warning',
            targetRole: 'STUDENT'
        }
    });

    await prisma.notification.create({
        data: {
            text: 'Your application has been received.',
            userId: students[0].id,
            type: 'success'
        }
    });

    console.log('\n🚀 SEEDING COMPLETED!');
    console.log('SuperAdmin: 0scar177771@gmail.com / Felopater');

    // ─── Auto-seed Attendance Settings (id=1, cannot be deleted) ──────────
    await (prisma as any).attendanceSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            checkInOpen: '07:00',
            lateAfter: '08:15',
            checkOutTime: '16:00',
            overtimeRate: 50,
            lockLate: false,
        }
    });
    await (prisma as any).weeklySchedule.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            monday: true, tuesday: true, wednesday: true,
            thursday: true, friday: true, saturday: false, sunday: false,
        }
    });
    console.log('✅ Attendance settings auto-seeded');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });