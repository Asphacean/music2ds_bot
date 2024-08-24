const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
        console.log(`Received command /sosi with URL: ${url}`);

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            console.log('User is not in a voice channel.');
            await interaction.reply({ content: 'You need to be in a voice channel to use this command!', ephemeral: true });
            return;
        }

        await interaction.deferReply();
        console.log(`User is in channel: ${voiceChannel.name}`);

        try {
            console.log(`Making API request to server with URL: ${url}`);
            const response = await axios({
                method: 'get',
                url: `https://nasra.li/api/download-audio?url=${encodeURIComponent(url)}`,
                responseType: 'stream'
            });

            const filePath = path.join(__dirname, '../../temp', `audio-${Date.now()}.mp3`);
            console.log(`Writing stream to file: ${filePath}`);
            const writer = fs.createWriteStream(filePath);

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('File has been written successfully.');
                    resolve();
                });
                writer.on('error', error => {
                    console.log('Error writing file:', error);
                    reject(error);
                });
            });

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            connection.subscribe(player);

            const resource = createAudioResource(filePath, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
            resource.volume.setVolume(1);
            player.play(resource);

            player.play(resource);
            connection.subscribe(player);
            console.log('Audio playback started.');

            player.on('stateChange', (oldState, newState) => {
                console.log(`Player state changed from ${oldState.status} to ${newState.status}`);
                if (newState.status === 'idle') {
                    console.log('Playback has finished. Cleaning up resources.');
                    fs.unlinkSync(filePath); // Clean up the audio file
                    connection.destroy(); // Leave the channel
                }
            });

            await interaction.followUp({ content: 'Playing your requested YouTube audio!' });
        } catch (error) {
            console.error('Error during command execution:', error);
            await interaction.followUp({ content: 'Failed to load the video. Please check the URL and try again.', ephemeral: true });
        }
    }
};
