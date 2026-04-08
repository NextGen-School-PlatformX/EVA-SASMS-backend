import type { Request, Response } from 'express';
import { ReportService } from '../services/reportService.js';

export const downloadStudentReport = async (req: Request, res: Response) => {
    try {
        const buffer = await ReportService.generateStudentCSV();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=students_report.csv');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
};

export const downloadFinanceReport = async (req: Request, res: Response) => {
    try {
        const buffer = await ReportService.generateFinanceCSV();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=finance_report.csv');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
};

export const downloadStudentPDF = async (req: Request, res: Response) => {
    try {
        const buffer = await ReportService.generateStudentPDF();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=students_roster.pdf');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

export const downloadFinancePDF = async (req: Request, res: Response) => {
    try {
        const buffer = await ReportService.generateFinancePDF();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=finance_report.pdf');
        res.send(buffer);
    } catch (error: any) {
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

