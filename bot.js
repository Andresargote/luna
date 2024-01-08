require('dotenv').config();
const mongoose = require('mongoose');
const Budget = require('./schemas/budget');
const { Telegraf, Markup } = require('telegraf');
const uuid = require('uuid');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.catch((err, ctx) => {
  console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
  const isConflictError = err.code === 409;
  if (isConflictError) {
    console.log('Conflict error');
    setTimeout(() => {
      ctx.telegram.handleUpdate(ctx.update);
    }, 1000);
  }
});

mongoose
  .connect(process.env.MONGO_DB_URL, {})
  .then(() => console.log('MongoDB connected...'))
  .catch((err) => console.log(err));

let state = '';
let newBudget = {};
let newExpense = {};

// Help command
bot.help((ctx) => {
  let message = '';
  message += '/start - Inicia el bot y muestra el menú principal.\n';
  message += '/menu - Muestra el menú principal.\n';
  message += '/help - Muestra esta lista de comandos disponibles.\n';
  ctx.reply(message);
});

// Menu command
bot.command('menu', (ctx) => {
  const buttons = Markup.inlineKeyboard([
    Markup.button.callback('💰 Crear presupuesto', 'createBudget'),
    Markup.button.callback('💲 Solicitar presupuesto', 'currentBudget'),
    Markup.button.callback('💸 Registrar gasto', 'registerExpense'),
    Markup.button.callback('📊 Ver gastos', 'expenseReport'),
  ]);
  ctx.reply('Aquí está el menú principal:', buttons);
});

// Current budget action
bot.action('currentBudget', async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const activeBudget = await Budget.findOne({
      chatId: chatId,
      active: true,
    });

    if (!activeBudget) {
      return ctx.reply('No tienes presupuestos activos.');
    }

    const createdAtFormatted = activeBudget.createdAt.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (ctx.chat.type == 'private') {
      return ctx.reply(
        `El presupuesto ${activeBudget.name} con la cantidad de ${activeBudget.amount}€ creada el ${createdAtFormatted} se encuentra activo y la cantidad actual es de ${activeBudget.currentAmount}€.`
      );
    }

    if (ctx.chat.type == 'group') {
      return ctx.reply(
        `El presupuesto ${activeBudget.name} con la cantidad de ${activeBudget.amount}€ creada el ${createdAtFormatted} por ${activeBudget.userName} se encuentra activo y la cantidad actual es de ${activeBudget.currentAmount}€.`
      );
    }
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

// Start command
bot.start((ctx) => {
  let message = '';

  const buttons = Markup.inlineKeyboard([
    Markup.button.callback('💰 Crear presupuesto', 'createBudget'),
  ]);

  if (ctx.chat.type == 'private') {
    message =
      'Hola, soy 🌙Luna, tu asistente bot para la gestión de presupuestos y gastos. A continuación, encontrarás un menú con todas las opciones disponibles para ayudarte a manejar tus finanzas de manera eficiente.';
  }

  if (ctx.chat.type == 'group') {
    message = `Hola, miembros del grupo ${ctx.chat.title}, soy 🌙Luna, tu asistente bot para la gestión de presupuestos y gastos. A continuación, te presento un menú con todas las opciones disponibles que te ayudarán a administrar tus finanzas de manera eficiente.`;
  }

  return ctx.reply(message, buttons);
});

// Create budget action
bot.action('createBudget', async (ctx) => {
  try {
    state = 'creatingBudget';
    newBudget = {};

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    const activeBudget = await Budget.findOne({
      userId: userId,
      chatId: chatId,
      active: true,
    });

    if (activeBudget) {
      const createdAtFormatted = activeBudget.createdAt.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return ctx.reply(
        `Estás seguro que quieres cancelar el presupuesto ${activeBudget.name} que creaste el día ${createdAtFormatted} y que pusiste una cantidad de ${activeBudget.amount}€?`,
        Markup.inlineKeyboard([
          Markup.button.callback('Sí', 'confirmCancel'),
          Markup.button.callback('No', 'denyCancel'),
        ])
      );
    }

    ctx.reply('Por favor, ingresa el nombre para el nuevo presupuesto:');
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

// Confirm cancel action
bot.action('confirmCancel', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    await Budget.updateOne(
      { userId: userId, chatId: chatId, active: true },
      { active: false }
    );

    newBudget = {};

    ctx.reply(
      'Presupuesto cancelado. Por favor, ingresa el nombre para el nuevo presupuesto:'
    );

    state = 'creatingBudget';
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

// Deny cancel action
bot.action('denyCancel', (ctx) => {
  ctx.reply('Operación cancelada.');
});

// Register expense action
bot.action('registerExpense', async (ctx) => {
  try {
    state = 'registeringExpense';
    newExpense = {};

    const activeBudget = await Budget.findOne({
      chatId: ctx.chat.id,
      active: true,
    });

    if (!activeBudget) {
      return ctx.reply('No tienes presupuestos activos.');
    }

    ctx.reply('Por favor, ingresa la cantidad del gasto:');
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

// Expense report action
bot.action('expenseReport', async (ctx) => {
  try {
    const chatId = ctx.chat.id;

    const activeBudget = await Budget.findOne({
      chatId: chatId,
      active: true,
    });

    if (!activeBudget) {
      return ctx.reply('No tienes presupuestos activos.');
    }

    if (activeBudget.expenses.length === 0) {
      return ctx.reply('No tienes gastos registrados.');
    }

    let message = '';

    activeBudget.expenses.forEach((expense) => {
      const dateFormatted = expense.date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      message += `🗓 ${dateFormatted} - 💸 ${expense.amount}€ - 📝 ${expense.description} - ${expense.userName} \n`;
    });

    ctx.reply(message);
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

// Message event
bot.on('message', async (ctx) => {
  try {
    if (state === 'creatingBudget') {
      const message = ctx.message.text;
      const userId = ctx.from.id;
      const chatId = ctx.chat.id;

      if (!newBudget.name) {
        newBudget.name = message;
        return ctx.reply('Por favor, ingresa la cantidad para el nuevo presupuesto:');
      }

      const amount = parseFloat(message);

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Por favor, ingresa un número válido mayor a cero.');
      }

      newBudget.id = uuid.v4();
      newBudget.amount = amount;
      newBudget.currentAmount = amount;
      newBudget.userId = userId;
      newBudget.chatId = chatId;
      newBudget.userName = ctx.from.first_name;

      const budget = new Budget(newBudget);
      await budget.save();

      ctx.reply(
        `🤩 Felicidades ${ctx.from.first_name}, has establecido un nuevo presupuesto llamado ${newBudget.name} con una cantidad de ${newBudget.amount}€.`
      );

      state = '';
      newBudget = {};

      return;
    }

    if (state === 'registeringExpense') {
      if (newExpense.amount === undefined) {
        const amount = parseFloat(ctx.message.text);

        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('Por favor, ingresa un número válido mayor a cero.');
        }

        newExpense.amount = amount;
        return ctx.reply('Por favor, ingresa una descripción para el gasto:');
      }

      if (!newExpense.description) {
        newExpense.description = ctx.message.text;
        newExpense.userId = ctx.from.id;
        newExpense.userName = ctx.from.first_name;
        newExpense.date = new Date();
        newExpense.id = uuid.v4();

        const activeBudget = await Budget.findOne({
          chatId: ctx.chat.id,
          active: true,
        });

        if (!activeBudget) {
          return ctx.reply('No tienes presupuestos activos.');
        }

        activeBudget.expenses.push(newExpense);
        activeBudget.currentAmount -= newExpense.amount;

        await activeBudget.save();

        ctx.reply(
          `Has registrado un gasto de ${newExpense.amount}€ en ${newExpense.description}. Tu monto disponible del presupuesto es ${activeBudget.currentAmount}€.`
        );

        newExpense = {};
        state = '';

        return;
      }
    }
  } catch (error) {
    ctx.reply('Ha ocurrido un error al procesar tu solicitud.');
  }
});

bot.launch();
