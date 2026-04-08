import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

export const sanitize = (data: any): any => {
    if (typeof data === 'string') {
        return DOMPurify.sanitize(data);
    }
    if (Array.isArray(data)) {
        return data.map(sanitize);
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized: any = {};
        for (const key in data) {
            // NoSQL Inject Protection: Remove keys starting with $ or containing .
            if (key.startsWith('$') || key.includes('.')) {
                continue;
            }
            sanitized[key] = sanitize(data[key]);
        }
        return sanitized;
    }
    return data;
};

export const xssMiddleware = (req: any, res: any, next: any) => {
    if (req.body) {
        // req.body is usually writable if body-parser is used
        req.body = sanitize(req.body);
    }

    // For query and params, mutate the properties inside to avoid "only a getter" errors
    if (req.query) {
        const sanitizedQuery = sanitize(req.query);
        for (const key in req.query) {
            delete req.query[key];
        }
        Object.assign(req.query, sanitizedQuery);
    }

    if (req.params) {
        const sanitizedParams = sanitize(req.params);
        for (const key in req.params) {
            delete req.params[key];
        }
        Object.assign(req.params, sanitizedParams);
    }
    next();
};
