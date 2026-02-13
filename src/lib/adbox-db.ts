/**
 * AdBox Database Operations - Prisma (PostgreSQL)
 */

import { prisma } from '@/lib/prisma';

export const adboxDb = {
  async findConversationById(id: string) {
    return prisma.conversation.findUnique({ where: { id } });
  },

  async findConversationByPageAndParticipant(pageId: string, participantId: string) {
    return prisma.conversation.findFirst({
      where: { pageId, participantId },
    });
  },

  async findConversationsByPageIds(pageIds: string[]) {
    return prisma.conversation.findMany({
      where: { pageId: { in: pageIds } },
      orderBy: { lastMessageAt: 'desc' },
    });
  },

  async upsertConversation(id: string, create: Record<string, unknown>, update: Record<string, unknown>) {
    return prisma.conversation.upsert({
      where: { id },
      create: { id, ...create } as never,
      update,
    });
  },

  async updateConversation(id: string, data: Record<string, unknown>) {
    return prisma.conversation.update({ where: { id }, data: data as never });
  },

  async findMessagesByConversation(conversationId: string, limit = 50) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  },

  async createMessage(data: {
    id: string;
    conversationId: string;
    senderId: string;
    senderName?: string;
    content?: string | null;
    attachments?: string | null;
    stickerUrl?: string | null;
    createdAt: Date;
    isFromPage?: boolean;
  }) {
    return prisma.message.create({ data });
  },

  async upsertMessage(id: string, create: Record<string, unknown>, update: Record<string, unknown>) {
    return prisma.message.upsert({
      where: { id },
      create: { id, ...create } as never,
      update,
    });
  },

  async findConversationsWithMessages(pageIds: string[], limit = 100) {
    return prisma.conversation.findMany({
      where: { pageId: { in: pageIds } },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async findNewMessagesForPages(pageIds: string[], sinceDate: Date) {
    return prisma.message.findMany({
      where: {
        conversation: { pageId: { in: pageIds } },
        createdAt: { gt: sinceDate },
        isFromPage: false,
      },
      include: {
        conversation: {
          select: { pageId: true, participantName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  },

  async findUpdatedConversations(pageIds: string[], sinceDate: Date) {
    return prisma.conversation.findMany({
      where: {
        pageId: { in: pageIds },
        lastMessageAt: { gt: sinceDate },
      },
      select: {
        id: true,
        pageId: true,
        snippet: true,
        unreadCount: true,
        lastMessageAt: true,
        participantId: true,
        participantName: true,
        adId: true,
        facebookLink: true,
        notes: true,
        labels: true,
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    });
  },
};
