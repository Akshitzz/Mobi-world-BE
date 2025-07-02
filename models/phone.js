import mongoose from 'mongoose';

const phoneSchema = new mongoose.Schema({
  modelNo: {
    type: String,
    required: [true, 'Model number is required'],
    trim: true,
    uppercase: true
  },
  imei1: {
    type: String,
    required: [true, 'Primary IMEI is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{15}$/.test(v);
      },
      message: 'IMEI must be 15 digits'
    }
  },
  imei2: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\d{15}$/.test(v);
      },
      message: 'IMEI 2 must be 15 digits'
    }
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  purchasePrice: {
    type: Number,
    required: [true, 'Purchase price is required'],
    min: [0, 'Purchase price cannot be negative']
  },
  salePrice: {
    type: Number,
    required: [true, 'Sale price is required'],
    min: [0, 'Sale price cannot be negative']
  },
  partyName: {
    type: String,
    required: [true, 'Party name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  images: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['in_stock', 'sold', 'damaged', 'returned'],
    default: 'in_stock'
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  soldDate: {
    type: Date
  },
  soldTo: {
    customerName: String,
    customerMobile: String,
    customerAddress: String
  },
  profit: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serialNumber: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate profit and generate serial number
phoneSchema.pre('save', function(next) {
  if (this.status === 'sold' && this.salePrice && this.purchasePrice) {
    this.profit = this.salePrice - this.purchasePrice;
  }
  
  if (!this.serialNumber) {
    this.serialNumber = 'PH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  
  next();
});

// Indexes for better performance
phoneSchema.index({ imei1: 1 });
phoneSchema.index({ modelNo: 1 });
phoneSchema.index({ status: 1 });
phoneSchema.index({ userId: 1 });
phoneSchema.index({ purchaseDate: -1 });

// Virtual field for total investment
phoneSchema.virtual('totalInvestment').get(function() {
  return this.purchasePrice;
});

// Virtual field for potential profit
phoneSchema.virtual('potentialProfit').get(function() {
  return this.salePrice - this.purchasePrice;
});

// Method to mark phone as sold
phoneSchema.methods.markAsSold = function(customerDetails) {
  this.status = 'sold';
  this.soldDate = new Date();
  this.soldTo = customerDetails;
  this.profit = this.salePrice - this.purchasePrice;
  return this.save();
};

// Static method to get inventory summary
phoneSchema.statics.getInventorySummary = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPurchaseValue: { $sum: '$purchasePrice' },
        totalSaleValue: { $sum: '$salePrice' },
        totalProfit: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$profit', 0] } }
      }
    }
  ]);
};

export default mongoose.model('Phone', phoneSchema);
