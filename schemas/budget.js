const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currentAmount: {
    type: Number,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  endAt: {
    type: Date,
    default: null,
    required: false,
  },
  expenses: [],
  userName: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  chatId: {
    type: Number,
    required: true,
  },
});

const Budget = mongoose.model('Budget', BudgetSchema);

module.exports = Budget;
