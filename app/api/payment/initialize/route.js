import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { amount, coupon, product } = body;

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Generate unique reference
    const reference = 'JAMB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email || 'customer@example.com', // Get from request
        amount: amount * 100, // Paystack uses kobo
        reference: reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://shineybrainacademy.vercel.app'}/jamb-playbook/thank-you`,
        metadata: {
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: product || 'jamb-playbook'
            },
            {
              display_name: "Coupon",
              variable_name: "coupon",
              value: coupon || 'none'
            }
          ]
        }
      }),
    });

    const data = await response.json();

    if (data.status) {
      return NextResponse.json({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      });
    } else {
      return NextResponse.json(
        { error: data.message || 'Payment initialization failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Payment initialization failed' },
      { status: 500 }
    );
  }
}
