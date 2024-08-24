const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sosi-stop')
        .setDescription('Stops the audio playback in your voice channel.'),
    async execute(interaction) {
        const voiceConnection = getVoiceConnection(interaction.guildId);

        if (!voiceConnection) {
            await interaction.reply({ content: 'I am not connected to any voice channel!', ephemeral: true });
            return;
        }

        voiceConnection.destroy(); // Disconnects and cleans up resources
        await interaction.reply('Stopped the audio playback and disconnected.');
    }
};
