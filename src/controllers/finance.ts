import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { FinanceService } from '../services/financeService.js';

export const getFeeCategories = async (req: Request, res: Response) => {
    try {
        const categories = await FinanceService.getFeeCategories();
        res.json(categories);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching fee categories', error: error.message });
    }
};

// ─── Payment Methods (JSON-backed, controlled by SuperAdmin) ───────────────────

const PAYMENT_METHODS_FILE = path.join(process.cwd(), 'payment_methods.json');

export const getPaymentMethods = async (_req: Request, res: Response) => {
    try {
        if (fs.existsSync(PAYMENT_METHODS_FILE)) {
            const raw = fs.readFileSync(PAYMENT_METHODS_FILE, 'utf-8');
            res.json(JSON.parse(raw));
        } else {
            res.json([]);
        }
    } catch {
        res.json([]);
    }
};

export const savePaymentMethods = async (req: Request, res: Response) => {
    try {
        const methods = Array.isArray(req.body) ? req.body : [];
        fs.writeFileSync(PAYMENT_METHODS_FILE, JSON.stringify(methods, null, 2));
        res.json({ success: true, methods });
    } catch (error: any) {
        res.status(500).json({ message: 'Error saving payment methods', error: error.message });
    }
};

export const createFeeCategory = async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const category = await FinanceService.createFeeCategory(req.body, adminId);
        res.status(201).json(category);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating fee category', error: error.message });
    }
};

export const processPayment = async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const transaction = await FinanceService.processPayment(req.body, adminId);
        res.status(201).json(transaction);
    } catch (error: any) {
        res.status(500).json({ message: 'Error processing payment', error: error.message });
    }
};

export const getTransactions = async (req: Request, res: Response) => {
    try {
        const transactions = await FinanceService.getTransactions(req.query);
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching transactions', error: error.message });
    }
};

export const getFees = async (req: Request, res: Response) => {
    try {
        const fees = await FinanceService.getFees();
        res.json(fees);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching fees', error: error.message });
    }
};

export const createFee = async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const fee = await FinanceService.createFee(req.body, adminId);
        res.status(201).json(fee);
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating fee', error: error.message });
    }
};

export const getFeePayments = async (req: Request, res: Response) => {
    try {
        const payments = await FinanceService.getFeePayments(req.query);
        res.json(payments);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching fee payments', error: error.message });
    }
};

export const approveFeePayment = async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { id } = req.params;
        const { approve, adminNote } = req.body;
        const result = await FinanceService.approveFeePayment(id as string, adminId, approve, adminNote);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating payment', error: error.message });
    }
};
