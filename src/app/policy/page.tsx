
export default function PrivacyPolicyPage() {
    return (
        <div className="max-w-3xl mx-auto p-6 md:p-12 space-y-6">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground text-sm">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">1. Introduction</h2>
                <p>
                    Centxo ("we", "our", or "us") is committed to protecting your privacy.
                    This Privacy Policy explains how we collect, use, and share your personal information when you use our services.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">2. Information We Collect</h2>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Account Information:</strong> Name, email address, and profile picture (via Facebook Login).</li>
                    <li><strong>Facebook Data:</strong> Ad accounts, pages, and marketing data you explicitly authorize us to access.</li>
                    <li><strong>Usage Data:</strong> Logs of your interactions with our platform for security and improvement purposes.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
                <p>We use your information to:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Provide, operate, and maintain our services.</li>
                    <li>manage your account and send you related information.</li>
                    <li>Sync and analyze your advertising data as requested.</li>
                </ul>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">4. Data Deletion</h2>
                <p>
                    You may request deletion of your data at any time.
                    If you authorized us via Facebook, you can remove the app from your Facebook Settings,
                    which will trigger a data deletion request to our system.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">5. Contact Us</h2>
                <p>
                    If you have questions about this policy, please contact us at support@centxo.com.
                </p>
            </section>
        </div>
    );
}
