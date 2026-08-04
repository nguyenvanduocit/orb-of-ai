import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { addCoins, loadCoins, saveCoins } from "../economy";
import { sleep } from "../scheduler";
import type { Command } from "../types";

type Choice = "keo" | "bua" | "bao";

// Cược cố định, chơi 1:1 với bot nên ván công bằng, KHÔNG thu phí nhà cái: thắng trả
// đúng 2× (hoà/hết giờ hoàn lại vốn). EV = 0 — ván không nghiêng về bot lẫn người chơi.
export const STAKE = 10;
export const WIN_MULTIPLIER = 2;
const WIN_RETURN = STAKE * WIN_MULTIPLIER; // 20: vốn 10 + lãi 10

// Nhịp "oẳn... tù... tì!" — tay bot lướt qua cả ba thế trước khi chốt, cho màn
// lật có một nhịp hồi hộp. Coin đã trả TRƯỚC khi chạy nhịp này nên crash giữa
// chừng không mất ván.
const BEAT_MS = 650;
const BEATS = [
  { hand: "✊", chant: "Oẳn..." },
  { hand: "🖐️", chant: "tù..." },
  { hand: "✌️", chant: "tì!" },
] as const;

const labels: Record<Choice, string> = {
  keo: "Kéo ✂️",
  bua: "Búa ✊",
  bao: "Bao 🖐️",
};

// keo < bua < bao < keo
const beats: Record<Choice, Choice> = { bua: "keo", bao: "bua", keo: "bao" };

const oantuti: Command = {
  data: new SlashCommandBuilder()
    .setName("oantuti")
    .setDescription(`Oẳn tù tì với bot — cược ${STAKE} 🪙, thắng ăn ${WIN_RETURN} 🪙 (không phí)`),
  async execute(interaction) {
    // Type narrowing only — the router (index.ts) already stubs non-guild interactions.
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Synchronous load→check→deduct→save — atomic on the event loop.
    const coins = loadCoins();
    const balance = coins[userId] ?? 0;
    if (balance < STAKE) {
      await interaction.reply({
        content: `Bro chỉ còn 🪙 ${balance}, cần ${STAKE} 🪙 để chơi. Điểm danh /diemdanh kiếm coin nhé!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    coins[userId] = balance - STAKE;
    saveCoins(coins);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      (["keo", "bua", "bao"] as const).map((choice) =>
        new ButtonBuilder()
          .setCustomId(`oantuti:${choice}`)
          .setLabel(labels[choice])
          .setStyle(ButtonStyle.Primary),
      ),
    );

    // Stake already taken — if the game message never materializes, give it back.
    let message;
    try {
      const response = await interaction.reply({
        content: `Đã cược ${STAKE} 🪙 — chọn đi bro! Kéo ✂️ / Búa ✊ / Bao 🖐️`,
        components: [row],
        withResponse: true,
      });
      message = response.resource?.message;
    } catch (error) {
      console.error("[oantuti] reply failed:", error);
    }
    if (!message) {
      addCoins(userId, STAKE);
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
    });

    collector.on("collect", async (i) => {
      // Never let a failed ack become an unhandled rejection (Bun kills the process).
      try {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "Ván này của người khác, bro tự mở ván mới nhé /oantuti",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const userChoice = i.customId.split(":")[1] as Choice;
        const botChoice = (["keo", "bua", "bao"] as const)[Math.floor(Math.random() * 3)]!;
        // Payout before the await: win returns stake x2, draw refunds the stake.
        let verdict: string;
        let newBalance: number;
        if (botChoice === userChoice) {
          verdict = `Hoà! 🤝 Trả lại ${STAKE} 🪙`;
          newBalance = addCoins(userId, STAKE);
        } else if (beats[userChoice] === botChoice) {
          verdict = `Bro thắng! 🎉 +${WIN_RETURN - STAKE} 🪙`;
          newBalance = addCoins(userId, WIN_RETURN);
        } else {
          verdict = `Mình thắng! 😎 -${STAKE} 🪙`;
          newBalance = loadCoins()[userId] ?? 0;
        }
        // Stop before the await: a failed update must not let the timeout
        // branch refund a round that already paid out.
        collector.stop();
        // First beat acks the click (strips the buttons); the rest chant on
        // the same message, then the final edit reveals both hands.
        await i.update({ content: `🥊 ${BEATS[0].hand}  **${BEATS[0].chant}**`, components: [] });
        for (let b = 1; b < BEATS.length; b++) {
          await sleep(BEAT_MS);
          await i.editReply({ content: `🥊 ${BEATS[b].hand}  **${BEATS[b].chant}**` });
        }
        await sleep(BEAT_MS);
        await i.editReply({
          content: `🤖 mình ra ${labels[botChoice]} — bro ra ${labels[userChoice]} → ${verdict} (số dư: 🪙 ${newBalance})`,
        });
      } catch (error) {
        console.error("[oantuti] button handling failed:", error);
      }
    });

    collector.on("end", async (_collected, reason) => {
      // Completed games stop with reason "user"; only clean up on timeout.
      if (reason !== "time") return;
      addCoins(userId, STAKE);
      try {
        await interaction.editReply({
          content: `⏰ Hết giờ rồi bro. Trả lại ${STAKE} 🪙 nhé.`,
          components: [],
        });
      } catch {
        // message may be gone — the refund above already happened
      }
    });
  },
};

export default oantuti;
