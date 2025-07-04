import express from 'express';
import Phone from '../models/phone.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all sales with filters and pagination
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      customerName,
      modelNo,
      sortBy = 'soldDate',
      sortOrder = 'desc',
      minProfit,
      maxProfit
    } = req.query;

    // Build query for sold phones
    const query = {
      userId: req.user.id,
      status: 'sold'
    };

    // Date range filter
    if (startDate || endDate) {
      query.soldDate = {};
      if (startDate) query.soldDate.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.soldDate.$lte = endDateTime;
      }
    }

    // Other filters
    if (customerName) {
      query['soldTo.customerName'] = { $regex: customerName, $options: 'i' };
    }
    if (modelNo) {
      query.modelNo = { $regex: modelNo, $options: 'i' };
    }
    if (minProfit || maxProfit) {
      query.profit = {};
      if (minProfit) query.profit.$gte = Number(minProfit);
      if (maxProfit) query.profit.$lte = Number(maxProfit);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const sales = await Phone.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('modelNo imei1 color purchasePrice salePrice profit soldDate soldTo');

    const total = await Phone.countDocuments(query);

    // Calculate summary for current page
    const pageSummary = sales.reduce((acc, sale) => {
      acc.totalSales += sale.salePrice;
      acc.totalProfit += sale.profit;
      acc.count += 1;
      return acc;
    }, { totalSales: 0, totalProfit: 0, count: 0 });

    res.json({
      success: true,
      data: sales,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit)
      },
      summary: pageSummary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales',
      error: error.message
    });
  }
});

// Get sales summary/statistics
router.get('/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = { userId: req.user.id, status: 'sold' };
    if (startDate || endDate) {
      dateFilter.soldDate = {};
      if (startDate) dateFilter.soldDate.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateFilter.soldDate.$lte = endDateTime;
      }
    }

    // Overall sales summary
    const overallSummary = await Phone.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$salePrice' },
          totalPurchase: { $sum: '$purchasePrice' },
          totalProfit: { $sum: '$profit' },
          phonesSold: { $sum: 1 },
          avgSalePrice: { $avg: '$salePrice' },
          avgProfit: { $avg: '$profit' },
          maxProfit: { $max: '$profit' },
          minProfit: { $min: '$profit' }
        }
      }
    ]);

    // Daily sales for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailySales = await Phone.aggregate([
      {
        $match: {
          userId: req.user.id,
          status: 'sold',
          soldDate: { $gte: startDate ? new Date(startDate) : thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$soldDate' }
          },
          dailySales: { $sum: '$salePrice' },
          dailyProfit: { $sum: '$profit' },
          phonesSold: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Sales by model
    const salesByModel = await Phone.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$modelNo',
          phonesSold: { $sum: 1 },
          totalSales: { $sum: '$salePrice' },
          totalProfit: { $sum: '$profit' },
          avgSalePrice: { $avg: '$salePrice' },
          avgProfit: { $avg: '$profit' }
        }
      },
      { $sort: { phonesSold: -1 } },
      { $limit: 10 }
    ]);

    // Top customers by purchase value
    const topCustomers = await Phone.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$soldTo.customerName',
          phonesBought: { $sum: 1 },
          totalSpent: { $sum: '$salePrice' },
          lastPurchase: { $max: '$soldDate' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Monthly trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrends = await Phone.aggregate([
      {
        $match: {
          userId: req.user.id,
          status: 'sold',
          soldDate: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$soldDate' },
            month: { $month: '$soldDate' }
          },
          sales: { $sum: '$salePrice' },
          profit: { $sum: '$profit' },
          phonesSold: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overall: overallSummary[0] || {
          totalSales: 0,
          totalPurchase: 0,
          totalProfit: 0,
          phonesSold: 0,
          avgSalePrice: 0,
          avgProfit: 0,
          maxProfit: 0,
          minProfit: 0
        },
        daily: dailySales,
        byModel: salesByModel,
        topCustomers,
        monthly: monthlyTrends
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales summary',
      error: error.message
    });
  }
});

// Get single sale details
router.get('/:id', auth, async (req, res) => {
  try {
    const sale = await Phone.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'sold'
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sale details',
      error: error.message
    });
  }
});

// Update sale details (like customer info)
router.put('/:id', auth, async (req, res) => {
  try {
    // Find the sold phone for this user
    const sale = await Phone.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'sold'
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Only allow updating certain fields
    const allowedFields = ['salePrice', 'soldDate', 'soldTo'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        sale[field] = req.body[field];
      }
    });

    // If salePrice or purchasePrice changed, recalculate profit
    if (req.body.salePrice !== undefined) {
      sale.profit = sale.salePrice - sale.purchasePrice;
    }

    await sale.save();

    res.json({
      success: true,
      message: 'Sale details updated successfully',
      data: sale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating sale details',
      error: error.message
    });
  }
});

export default router;
