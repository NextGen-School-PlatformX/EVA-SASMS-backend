import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';

export class ReportService {
    static async generateStudentCSV() {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { name: true, email: true, status: true, createdAt: true }
        });

        const header = 'Name,Email,Status,JoinedAt\n';
        const rows = students.map(s => `${s.name},${s.email},${s.status},${s.createdAt.toISOString()}`).join('\n');

        return Buffer.from(header + rows);
    }

    static async generateFinanceCSV() {
        const transactions = await prisma.transaction.findMany({
            include: { feeCategory: true }
        });

        const header = 'ID,Amount,Type,Status,Category,Date\n';
        const rows = transactions.map(t =>
            `${t.id},${t.amount},${t.type},${t.status},${t.feeCategory?.name || 'N/A'},${t.createdAt.toISOString()}`
        ).join('\n');

        return Buffer.from(header + rows);
    }

    static async generateStudentPDF(): Promise<Buffer> {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            include: { academicClass: true, department: true }
        });

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks: any[] = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(20).text('SASMS - Official Student Roster', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
            doc.moveDown();

            students.forEach((s: any, i: number) => {
                doc.fontSize(12).fillColor('black').text(`${i + 1}. ${s.name}`, { continued: true });
                doc.fontSize(10).fillColor('gray').text(` (${s.email})`);
                doc.fontSize(10).fillColor('black').text(`   Status: ${s.status} | Dept: ${s.department?.name || 'N/A'} | Class: ${s.academicClass?.name || 'N/A'}`);
                doc.moveDown(0.5);
            });

            doc.end();
        });
    }

    static async generateFinancePDF(): Promise<Buffer> {
        const transactions = await prisma.transaction.findMany({
            include: { feeCategory: true, user: { select: { name: true } } }
        });

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks: any[] = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(20).text('SASMS - Financial Transaction Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
            doc.moveDown();

            transactions.forEach((t: any, i: number) => {
                doc.fontSize(12).fillColor('black').text(`${i + 1}. ${t.user?.name || 'Unknown'} - ${t.amount} EGP`);
                doc.fontSize(10).fillColor('black').text(`   Type: ${t.type} | Status: ${t.status} | Category: ${t.feeCategory?.name || 'N/A'}`);
                doc.fontSize(8).fillColor('gray').text(`   Reference: ${t.reference || 'N/A'} | Date: ${t.createdAt.toLocaleString()}`);
                doc.moveDown(0.5);
            });

            doc.end();
        });
    }
}


