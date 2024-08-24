require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const token = process.env.DISCORD_TOKEN;
const apiUrl = process.env.API_URL;

const queue = []; // Глобальная очередь воспроизведения

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sosi')
        .setDescription('Plays audio from a YouTube video in your voice channel.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL of the YouTube video')
                .setRequired(true)),
    async execute(interaction) {
        const url = interaction.options.getString('url');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to be in a voice channel to use this command!', ephemeral: true });
            return;
        }

        // Добавляем видео в очередь
        queue.push({ url, voiceChannel, interaction });

        // Если очередь воспроизведения пустая, начинаем воспроизведение
        if (queue.length === 1) {
            playNextInQueue();
        } else {
            await interaction.reply({ content: 'Added to the queue!', ephemeral: true });
        }
    }
};

// Функция для воспроизведения следующего трека в очереди
async function playNextInQueue() {
    if (queue.length === 0) return; // Если очередь пуста, прекращаем выполнение

    const { url, voiceChannel, interaction } = queue[0]; // Берем первый элемент из очереди

    try {
        const response = await axios({
            method: 'get',
            url: `${apiUrl}?url=${encodeURIComponent(url)}`,
            responseType: 'stream'
        });

        const filePath = path.join(__dirname, 'download.mp3');
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource(filePath, {
            inputType: StreamType.Arbitrary,
        });

        player.play(resource);
        connection.subscribe(player);

        player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle') {
                fs.unlinkSync(filePath); // Удаляем аудиофайл
                queue.shift(); // Удаляем текущий элемент из очереди
                playNextInQueue(); // Запускаем следующий трек в очереди
            }
        });

        await interaction.followUp({ content: 'Playing your YouTube audio!' });
    } catch (error) {
        console.error('Error during command execution:', error);
        await interaction.followUp({ content: 'Failed to load the video. Please check the URL and try again.', ephemeral: true });
        queue.shift(); // Удаляем элемент из очереди при ошибке
        playNextInQueue(); // Пытаемся воспроизвести следующий трек
    }
}

client.login(token);
