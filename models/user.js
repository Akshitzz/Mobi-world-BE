import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: 'Please enter a valid 10-digit mobile number'
    }
  },
  shopName: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true,
    default: 'Mobile Shop'
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  businessType: {
    type: String,
    enum: ['retail', 'wholesale', 'both'],
    default: 'retail'
  },
  gstNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Please enter a valid GST number'
    }
  },
  profileImage: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    maxPhones: {
      type: Number,
      default: 50
    }
  },
  preferences: {
    currency: {
      type: String,
      default: 'INR'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Get user stats
userSchema.methods.getStats = async function() {
  const Phone = mongoose.model('Phone');
  
  const stats = await Phone.aggregate([
    { $match: { userId: this._id } },
    {
      $group: {
        _id: null,
        totalPhones: { $sum: 1 },
        soldPhones: {
          $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
        },
        inStockPhones: {
          $sum: { $cond: [{ $eq: ['$status', 'in_stock'] }, 1, 0] }
        },
        totalPurchaseAmount: { $sum: '$purchasePrice' },
        totalSaleAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$salePrice', 0] }
        },
        totalProfit: {
          $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$profit', 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalPhones: 0,
    soldPhones: 0,
    inStockPhones: 0,
    totalPurchaseAmount: 0,
    totalSaleAmount: 0,
    totalProfit: 0
  };
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 });

export default mongoose.model('User', userSchema);
