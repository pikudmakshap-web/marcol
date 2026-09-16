const generateReceiptHTML = (transaction) => {
    const formattedDate = new Date(transaction.createdAt || Date.now()).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const itemsHtml = transaction.items.map(item => `
                    <!-- Item -->
                    <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #f3f4f6;">
                            <img src="${item.imageUrl || 'https://placehold.co/100x100?text=No+Image'}" alt="${item.productName}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
                        </td>
                        <td style="padding: 15px 10px; border-bottom: 1px solid #f3f4f6;">
                            <p style="margin: 0; color: #111827; font-weight: bold;">${item.productName}</p>
                            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${Number(item.unitPrice).toFixed(1)} ₪ ליחידה</p>
                        </td>
                        <td style="padding: 15px 0; border-bottom: 1px solid #f3f4f6; text-align: center; color: #111827;">${item.quantity}</td>
                        <td style="padding: 15px 0; border-bottom: 1px solid #f3f4f6; text-align: left; color: #111827; font-weight: bold;">${Number(item.lineTotal || (item.unitPrice * item.quantity)).toFixed(1)} ₪</td>
                    </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>קבלה על רכישה</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: Arial, sans-serif; direction: rtl; text-align: right;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <tr>
            <td style="background-color: #2563eb; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">תודה על הקנייה!</h1>
                <p style="color: #bfdbfe; margin-top: 10px; margin-bottom: 0;">ההזמנה שלך התקבלה בהצלחה</p>
            </td>
        </tr>

        <!-- Transaction Details -->
        <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td width="50%">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">מספר עסקה:</p>
                            <p style="margin: 5px 0 0 0; color: #111827; font-weight: bold;">${transaction.transactionNumber || '---'}</p>
                        </td>
                        <td width="50%" style="text-align: left;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">תאריך:</p>
                            <p style="margin: 5px 0 0 0; color: #111827; font-weight: bold;">${formattedDate}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Items -->
        <tr>
            <td style="padding: 30px;">
                <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px;">פירוט המוצרים</h2>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <!-- List Header -->
                    <tr>
                        <th style="padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; font-size: 14px; width: 60px;">מוצר</th>
                        <th style="padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; font-size: 14px;"></th>
                        <th style="padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; width: 60px;">כמות</th>
                        <th style="padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #6b7280; font-size: 14px; width: 80px;">סה"כ</th>
                    </tr>

                    ${itemsHtml}
                </table>
            </td>
        </tr>

        <!-- Total -->
        <tr>
            <td style="padding: 20px 30px; background-color: #f8fafc; text-align: left;">
                <p style="margin: 0; display: inline-block; margin-left: 20px; color: #6b7280; font-size: 16px;">סה"כ לתשלום:</p>
                <p style="margin: 0; display: inline-block; color: #2563eb; font-size: 24px; font-weight: bold;">${Number(transaction.totalAmount || 0).toFixed(1)} ₪</p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="padding: 20px 30px; text-align: center; background-color: #1e293b;">
                <p style="margin: 0; color: #e2e8f0; font-size: 14px;">שולם באמצעות ארנק: ${transaction.wallet?.name || '---'}</p>
                <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} החנות המערכתית. כל הזכויות שמורות.</p>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

const sendPurchaseEmail = async (transaction) => {
    try {
        const html = generateReceiptHTML(transaction);
        // Simulate sending email via nodemailer
        console.log("================ MOCK EMAIL SERVICE ===================");
        console.log("Sending Receipt Email to User ID:", transaction.officer?.id || 'Unknown');
        console.log(`Transaction: ${transaction.transactionNumber} | Total: ${transaction.totalAmount}`);
        console.log(`HTML Payload Length: ${html.length} characters`);
        console.log("=======================================================");
        return true;
    } catch (error) {
        console.error("Error in sendPurchaseEmail:", error);
        return false;
    }
}

module.exports = { generateReceiptHTML, sendPurchaseEmail };
