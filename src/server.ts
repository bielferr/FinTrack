import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// Carrega TOKEN e CLIENT_ID
const TOKEN = process.env.DISCORD_TOKEN as string;
const CLIENT_ID = process.env.CLIENT_ID as string;


// Caminho do arquivo JSON
const DB_PATH = "./data/gastos.json";

// Função para ler o banco (JSON)
function loadDB() {
    if (!fs.existsSync("./data")) {
        fs.mkdirSync("./data");
    }

    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, "{}");
    }

    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}


// Função para salvar o banco
function saveDB(data: any) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName("addgasto")
        .setDescription("Adiciona um gasto")
        .addNumberOption(opt =>
            opt.setName("valor")
                .setDescription("Valor do gasto")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("categoria")
                .setDescription("Categoria do gasto")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("saldo")
        .setDescription("Mostra seu saldo"),

    new SlashCommandBuilder()
        .setName("extrato")
        .setDescription("Mostra seus gastos recentes"),

        new SlashCommandBuilder()
    .setName("setrenda")
    .setDescription("Define seu saldo inicial")
    .addNumberOption(opt =>
        opt.setName("valor")
            .setDescription("Saldo inicial")
            .setRequired(true)
    ),

    new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Zera seu saldo e todos os gastos"),

].map(cmd => cmd.toJSON());

// Registra comandos no Discord
const rest = new REST({ version: "10" }).setToken(TOKEN);
async function registerCommands() {
    try {
        console.log("Registrando comandos...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("Comandos registrados!");
    } catch (err) {
        console.error(err);
    }
}

//  BOT

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once("ready", () => {
    console.log(`Bot online como ${client.user?.tag}`);
});


client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const db = loadDB();
    const id = interaction.user.id;

    if (!db[id]) {
        db[id] = {
            saldo: 0,
            gastos: []
        };
    }

    // /addgasto
    if (interaction.commandName === "addgasto") {
    await interaction.deferReply(); // <- impede o erro "bot não respondeu"

    const valor = interaction.options.getNumber("valor", true);
    const categoria = interaction.options.getString("categoria", true);

    db[id].saldo -= valor;
    db[id].gastos.push({
        valor,
        categoria,
        data: new Date().toISOString()
    });

    saveDB(db);

    await interaction.editReply(`💸 Gasto de **R$${valor}** adicionado na categoria **${categoria}**!\nSaldo atual: **R$${db[id].saldo}**`);
    }
    // /saldo
    if (interaction.commandName === "saldo") {
        await interaction.reply(`💰 Seu saldo atual é: **R$${db[id].saldo}**`);
    }

    // /extrato
    if (interaction.commandName === "extrato") {
        const lista = db[id].gastos
            .slice(-10)
            .map(g => `• R$${g.valor} — ${g.categoria} (${g.data.split("T")[0]})`)
            .join("\n");

        await interaction.reply(`📃 **Últimos gastos:**\n${lista || "Nenhum gasto registrado."}`);
    }

    // /setrenda
if (interaction.commandName === "setrenda") {
    const valor = interaction.options.getNumber("valor", true);

    db[id].saldo = valor;
    saveDB(db);

    await interaction.reply(`💰 Seu saldo inicial foi definido como **R$${valor}**`);
}

// /reset
if (interaction.commandName === "reset") {
    db[id] = {
        saldo: 0,
        gastos: []
    };

    saveDB(db);

    await interaction.reply("♻️ Seu saldo e lista de gastos foram zerados!");
}


});

// iniciar
registerCommands();
client.login(TOKEN);

// Backup diário automático
setInterval(() => {
    const db = loadDB();
    const date = new Date().toISOString().split("T")[0];
    const backupPath = `./data/backups/backup-${date}.json`;

    if (!fs.existsSync("./data/backups")) {
        fs.mkdirSync("./data/backups");
    }

    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
    console.log("Backup diário salvo:", backupPath);
}, 24 * 60 * 60 * 1000); // 24 horas

