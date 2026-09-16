const generateReceiptHTML = (transaction) => {
    const formattedDate = new Date(transaction.createdAt || Date.now()).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const itemsByCategory = transaction.items.reduce((acc, item) => {
        const category = item.categoryName || 'כללי';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});

    let itemsHtml = '';
    for (const [category, items] of Object.entries(itemsByCategory)) {
        itemsHtml += `
                    <tr>
                        <td colspan="4" style="padding: 15px 0 5px 0; border-bottom: 2px solid #e5e7eb;">
                            <h3 style="margin: 0; color: #374151; font-size: 16px; font-weight: bold;">${category}</h3>
                        </td>
                    </tr>
        `;
        itemsHtml += items.map(item => `
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
    }

    // יצירת טבלת יתרות לפי קטגוריות
    let categoryBalancesHtml = '';
    if (transaction.categoryBalances && transaction.categoryBalances.length > 0) {
        const rows = transaction.categoryBalances.map((cb, index) => {
            // צבעים שונים לכל קטגוריה כדי לתת מראה מעוצב ודינמי
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
            const dotColor = colors[index % colors.length];
            return `
            <tr>
                <td style="padding: 12px 15px; border-top: 1px solid #e2e8f0; color: #334155; font-size: 14px;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${dotColor}; margin-left: 8px; vertical-align: middle;"></span>
                    <span style="vertical-align: middle;">${cb.categoryName}</span>
                </td>
                <td style="padding: 12px 15px; border-top: 1px solid #e2e8f0; text-align: left; color: #0f172a; font-weight: 800; font-size: 14px;">
                    ${Number(cb.balance).toFixed(1)} ₪
                </td>
            </tr>
            `;
        }).join('');

        categoryBalancesHtml = `
        <!-- Category Balances -->
        <tr>
            <td style="padding: 0 30px 30px 30px;">
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 800;">פירוט יתרות מעודכן לפי קטגוריה:</h3>
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr style="background-color: #f8fafc;">
                            <th style="padding: 12px 15px; text-align: right; color: #64748b; font-size: 13px; font-weight: bold;">שם קטגוריה</th>
                            <th style="padding: 12px 15px; text-align: left; color: #64748b; font-size: 13px; font-weight: bold;">יתרה זמינה</th>
                        </tr>
                        ${rows}
                    </table>
                </div>
            </td>
        </tr>
        `;
    }

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>קבלה על רכישה</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: Segoe UI, Arial, sans-serif; direction: rtl; text-align: right;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; margin-top: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <tr>
            <td style="background-color: #10b981; padding: 40px 30px; text-align: center;">
                <div style="background-color: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                    <span style="font-size: 30px; color: white;">✓</span>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">הרכישה בוצעה בהצלחה!</h1>
                <p style="color: #d1fae5; margin-top: 10px; margin-bottom: 0; font-size: 16px;">תודה על הקנייה בחנות המערכתית</p>
            </td>
        </tr>

        <!-- Payment Source - MOVED UP & ENLARGED -->
        <tr>
            <td style="padding: 25px 30px; background-color: #f0fdf4; border-bottom: 1px solid #dcfce7; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 16px;">שולם באמצעות ארנק:</p>
                <h2 style="margin: 5px 0 0 0; color: #15803d; font-size: 24px; font-weight: 800;">${transaction.wallet?.name || '---'}</h2>
            </td>
        </tr>

        <!-- Transaction Details -->
        <tr>
            <td style="padding: 20px 30px; border-bottom: 1px solid #f3f4f6;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td width="50%">
                            <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">מספר עסקה</p>
                            <p style="margin: 4px 0 0 0; color: #111827; font-weight: 700; font-size: 15px;">${transaction.transactionNumber || '---'}</p>
                        </td>
                        <td width="50%" style="text-align: left;">
                            <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">תאריך שעה</p>
                            <p style="margin: 4px 0 0 0; color: #111827; font-weight: 700; font-size: 15px;">${formattedDate}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Items -->
        <tr>
            <td style="padding: 30px 30px 10px 30px;">
                <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 800;">פירוט הזמנה</h2>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <!-- List Header - HIGHLIGHTED -->
                    <tr>
                        <th style="padding-bottom: 12px; border-bottom: 2px solid #111827; text-align: right; color: #111827; font-size: 14px; font-weight: 800; width: 60px;">מוצר</th>
                        <th style="padding-bottom: 12px; border-bottom: 2px solid #111827; text-align: right; color: #111827; font-size: 14px; font-weight: 800;"></th>
                        <th style="padding-bottom: 12px; border-bottom: 2px solid #111827; text-align: center; color: #111827; font-size: 14px; font-weight: 800; width: 60px;">כמות</th>
                        <th style="padding-bottom: 12px; border-bottom: 2px solid #111827; text-align: left; color: #111827; font-size: 14px; font-weight: 800; width: 80px;">סה"כ</th>
                    </tr>

                    ${itemsHtml}
                </table>
            </td>
        </tr>

        <!-- Summary Totals -->
        <tr>
            <td style="padding: 10px 30px 30px 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #f3f4f6; margin-top: 10px;">
                    <!-- Total Items Count -->
                    <tr>
                        <td style="padding-top: 20px; color: #6b7280; font-size: 15px;">סה"כ פריטים שנקנו:</td>
                        <td style="padding-top: 20px; text-align: left; color: #111827; font-weight: 700; font-size: 15px;">${transaction.totalItemsCount || transaction.items.reduce((sum, i) => sum + i.quantity, 0)} יחידות</td>
                    </tr>
                    <!-- Total Price -->
                    <tr>
                        <td style="padding-top: 15px; color: #111827; font-size: 18px; font-weight: 800;">סה"כ לתשלום:</td>
                        <td style="padding-top: 15px; text-align: left; color: #10b981; font-size: 24px; font-weight: 900;">${Number(transaction.totalAmount || 0).toFixed(1)} ₪</td>
                    </tr>
                    <!-- Remaining Balance - Conditional -->
                    ${(!transaction.categoryBalances || transaction.categoryBalances.length === 0) ? `
                    <tr>
                        <td style="padding-top: 20px; padding-bottom: 10px;">
                            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 15px; display: inline-block;">
                                <span style="color: #64748b; font-size: 14px;">יתרה כוללת נותרת בארנק:</span>
                                <span style="color: #1e293b; font-weight: 800; font-size: 16px; margin-right: 8px;">${Number(transaction.currentBalance || 0).toFixed(1)} ₪</span>
                            </div>
                        </td>
                        <td></td>
                    </tr>
                    ` : ''}
                </table>
            </td>
        </tr>

        ${categoryBalancesHtml}

        <!-- Wallet Members -->
        ${transaction.walletMembers && transaction.walletMembers.length > 0 ? `
        <tr>
            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                <h3 style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">משתמשים נוספים בארנק:</h3>
                <div style="line-height: 1.6;">
                    ${transaction.walletMembers.map(member => `
                        <span style="background-color: #ffffff; color: #334155; padding: 4px 12px; border-radius: 16px; font-size: 12px; border: 1px solid #e2e8f0; display: inline-block; margin: 2px; font-weight: 600;">
                            ${member.fullName} • ${member.personalNumber || '---'}
                        </span>
                    `).join('')}
                </div>
            </td>
        </tr>
        ` : ''}

        <!-- Footer Footer -->
        <tr>
            <td style="padding: 30px; text-align: center; background-color: #111827;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">נשלח ע"י מערכת המלאי והמכירות המערכתית.<br>© ${new Date().getFullYear()} החנות המערכתית. כל הזכויות שמורות.</p>
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
        console.log("Sending Receipt Email to User Name:", transaction.officer?.fullName || 'Unknown');
        console.log(`Transaction: ${transaction.transactionNumber} | Total: ${transaction.totalAmount}`);
        console.log(`Remaining Wallet Balance: ${transaction.currentBalance}`);
        console.log(`Total Items: ${transaction.totalItemsCount}`);
        console.log("=======================================================");
        return true;
    } catch (error) {
        console.error("Error in sendPurchaseEmail:", error);
        return false;
    }
}

module.exports = { generateReceiptHTML, sendPurchaseEmail };
