import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  User,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { isTicketStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  TaskPriority,
  TaskStatus,
} from "../../lib/store";

const PRIORITY_EMOJIS: Record<TaskPriority, string> = {
  low: "🟢 Low",
  normal: "🔵 Normal",
  high: "🟡 High",
  urgent: "🔴 URGENT",
};

const STATUS_EMOJIS: Record<TaskStatus, string> = {
  todo: "📋 To-Do",
  in_progress: "⏳ In Progress",
  done: "✅ Completed",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("task")
    .setDescription("Vyntric Team project & task management")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new project/team task")
        .addStringOption((opt) =>
          opt
            .setName("title")
            .setDescription("Short title of the task")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("priority")
            .setDescription("Priority level")
            .setRequired(false)
            .addChoices(
              { name: "Low", value: "low" },
              { name: "Normal", value: "normal" },
              { name: "High", value: "high" },
              { name: "Urgent", value: "urgent" }
            )
        )
        .addUserOption((opt) =>
          opt
            .setName("assignee")
            .setDescription("Team member assigned to this task")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription("Additional details/requirements")
            .setRequired(false)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List active team tasks")
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Filter tasks by status")
            .setRequired(false)
            .addChoices(
              { name: "All", value: "all" },
              { name: "To-Do", value: "todo" },
              { name: "In Progress", value: "in_progress" },
              { name: "Done", value: "done" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("update")
        .setDescription("Update status of a task")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Task ID (e.g. TSK-1)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("New status")
            .setRequired(true)
            .addChoices(
              { name: "To-Do", value: "todo" },
              { name: "In Progress", value: "in_progress" },
              { name: "Done", value: "done" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a task")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Task ID (e.g. TSK-1)")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !isTicketStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Vyntric staff members can access the task management board.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description") || "No extra details.";
      const priority = (interaction.options.getString("priority") as TaskPriority) || "normal";
      const assignee = interaction.options.getUser("assignee");

      const task = createTask({
        guildId: interaction.guild.id,
        title,
        description,
        priority,
        status: "todo",
        assigneeId: assignee?.id ?? null,
        assigneeTag: assignee ? assignee.tag : null,
        createdById: interaction.user.id,
        createdByTag: interaction.user.tag,
      });

      const embed = vyntricEmbed("primary")
        .setTitle(`📌 Task Created: ${task.id}`)
        .setDescription(
          `${section("Task Details")}\n` +
            `• **Title:** ${task.title}\n` +
            `• **Description:** ${task.description}\n` +
            `• **Priority:** ${PRIORITY_EMOJIS[task.priority]}\n` +
            `• **Status:** ${STATUS_EMOJIS[task.status]}\n` +
            `• **Assignee:** ${task.assigneeId ? `<@${task.assigneeId}>` : "_Unassigned_"}\n` +
            `• **Created By:** <@${task.createdById}>`
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      const statusFilter = interaction.options.getString("status");
      const filter = statusFilter && statusFilter !== "all" ? (statusFilter as TaskStatus) : undefined;
      const tasks = listTasks(interaction.guild.id, filter);

      if (tasks.length === 0) {
        await interaction.reply({
          content: "📋 No tasks found matching your filter.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = tasks.slice(0, 15).map((t) => {
        const who = t.assigneeId ? `<@${t.assigneeId}>` : "_unassigned_";
        return `\`${t.id}\` **${t.title}**\n↳ ${STATUS_EMOJIS[t.status]} | ${PRIORITY_EMOJIS[t.priority]} | Assigned: ${who}`;
      });

      const embed = vyntricEmbed("accent")
        .setTitle("📋 Vyntric Project & Task Board")
        .setDescription(
          `${section("Active Tasks")}\n` +
            lines.join("\n\n") +
            (tasks.length > 15 ? `\n\n_...and ${tasks.length - 15} more tasks._` : "")
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "update") {
      const id = interaction.options.getString("id", true);
      const newStatus = interaction.options.getString("status", true) as TaskStatus;

      const updated = updateTask(interaction.guild.id, id, { status: newStatus });
      if (!updated) {
        await interaction.reply({
          content: `⚠️ Task \`${id}\` not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: `✅ Task \`${updated.id}\` status updated to **${STATUS_EMOJIS[updated.status]}**!`,
      });
      return;
    }

    if (sub === "delete") {
      const id = interaction.options.getString("id", true);
      const ok = deleteTask(interaction.guild.id, id);
      if (!ok) {
        await interaction.reply({
          content: `⚠️ Task \`${id}\` not found.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: `🗑️ Task \`${id}\` has been deleted from the board.`,
      });
      return;
    }
  },
};

export default command;
