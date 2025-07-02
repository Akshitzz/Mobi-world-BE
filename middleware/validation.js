import { body, validationResult } from 'express-validator';

export const validateRegister = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('mobile').notEmpty().withMessage('Mobile is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

export const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

export const validatePhone = [
  body('modelNo').notEmpty().withMessage('Model number is required'),
  body('imei1').isLength({ min: 15, max: 15 }).withMessage('IMEI1 must be 15 digits'),
  body('color').notEmpty().withMessage('Color is required'),
  body('purchasePrice').isNumeric().withMessage('Purchase price is required'),
  body('salePrice').optional().isNumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

export const validateSale = [
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('customerMobile').notEmpty().withMessage('Customer mobile is required'),
  body('salePrice').isNumeric().withMessage('Sale price is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];
