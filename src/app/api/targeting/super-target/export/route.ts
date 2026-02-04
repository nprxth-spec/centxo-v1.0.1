
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'csv';

        // Fetch all interests sorted by Topic then Size
        const interests = await prisma.facebookInterest.findMany({
            orderBy: [
                { topic: 'asc' },
                { audienceSizeUpperBound: 'desc' }
            ]
        });

        if (interests.length === 0) {
            return NextResponse.json({ error: 'No data to export' }, { status: 404 });
        }

        const data = interests.map(i => ({
            'Interest Name': i.name,
            'Category (Topic)': i.topic || 'Uncategorized',
            'Audience Size (Min)': Number(i.audienceSizeLowerBound),
            'Audience Size (Max)': Number(i.audienceSizeUpperBound),
            'Facebook ID': i.fbId
        }));

        if (format === 'xlsx') {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Interests");

            // Adjust column widths
            const wscols = [
                { wch: 30 }, // Name
                { wch: 20 }, // Topic
                { wch: 20 }, // Size Min
                { wch: 20 }, // Size Max
                { wch: 20 }, // ID
            ];
            worksheet['!cols'] = wscols;

            const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

            return new NextResponse(buf, {
                status: 200,
                headers: {
                    'Content-Disposition': `attachment; filename = "interests_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }
            });
        }

        // Default to CSV
        const header = ['Interest Name', 'Category (Topic)', 'Audience Size (Min)', 'Audience Size (Max)', 'Facebook ID'];
        const csvRows = interests.map(i => {
            const name = i.name.replace(/"/g, '""');
            const topic = (i.topic || 'Uncategorized').replace(/"/g, '""');
            return [
                `"${name}"`,
                `"${topic}"`,
                i.audienceSizeLowerBound?.toString() || '0',
                i.audienceSizeUpperBound?.toString() || '0',
                `"${i.fbId}"`
            ].join(',');
        });

        const csvContent = [header.join(','), ...csvRows].join('\n');

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename = "interests_export_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error) {
        console.error('Export failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
