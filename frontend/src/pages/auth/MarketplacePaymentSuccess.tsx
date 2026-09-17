import { useEffect, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

export default function MarketplacePaymentSuccess() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState(
      "Verifying your Cashfree payment..."
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const verifyPayment = async () => {
      // ------------------------------------------------------
      // Get the local EduSphere order ID.
      // ------------------------------------------------------

      const rawOrderId =
        searchParams.get(
          "edusphere_order_id"
        );

      if (!rawOrderId) {
        setError(
          "EduSphere order ID was not found."
        );

        setLoading(false);

        return;
      }

      const orderId =
        Number(rawOrderId);

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        setError(
          "Invalid EduSphere order ID."
        );

        setLoading(false);

        return;
      }

      try {
        // ====================================================
        // STEP 1
        // Get the payment stored in EduSphere.
        //
        // This gives us the actual Cashfree gateway order ID.
        // ====================================================

        const paymentResponse =
          await fetch(
            `${API_BASE_URL}/marketplace/payments/order/${orderId}`,
            {
              method: "GET",

              credentials: "include",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const paymentData =
          await paymentResponse
            .json()
            .catch(() => null);

        if (!paymentResponse.ok) {
          throw new Error(
            String(
              paymentData?.detail ||
                paymentData?.message ||
                "Unable to load payment information."
            )
          );
        }

        // ----------------------------------------------------
        // If already PAID, don't verify twice.
        // ----------------------------------------------------

        if (
          String(
            paymentData?.status || ""
          ).toUpperCase() === "PAID"
        ) {
          if (!cancelled) {
            setMessage(
              `Payment successful. Order #${orderId} is confirmed.`
            );

            setLoading(false);
          }

          return;
        }

        // ----------------------------------------------------
        // Cashfree order ID must exist.
        // ----------------------------------------------------

        if (
          !paymentData?.gateway_order_id
        ) {
          throw new Error(
            "Cashfree gateway order ID is missing."
          );
        }

        // ====================================================
        // STEP 2
        // Server-side Cashfree verification.
        // ====================================================

        const verifyResponse =
          await fetch(
            `${API_BASE_URL}/marketplace/payments/verify`,
            {
              method: "POST",

              credentials: "include",

              headers: {
                Accept:
                  "application/json",

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                order_id: orderId,

                gateway_order_id:
                  paymentData.gateway_order_id,
              }),
            }
          );

        const verifyData =
          await verifyResponse
            .json()
            .catch(() => null);

        if (!verifyResponse.ok) {
          throw new Error(
            String(
              verifyData?.detail ||
                verifyData?.message ||
                "Cashfree payment verification failed."
            )
          );
        }

        const status =
          String(
            verifyData?.status || ""
          ).toUpperCase();

        // ====================================================
        // PAYMENT SUCCESS
        // ====================================================

        if (
          status === "PAID" ||
          status === "SUCCESS"
        ) {
          if (!cancelled) {
            setMessage(
              `Payment successful. Order #${orderId} is confirmed.`
            );

            setLoading(false);
          }

          return;
        }

        // ====================================================
        // PAYMENT NOT COMPLETED
        // ====================================================

        throw new Error(
          `Cashfree payment is not completed yet. Status: ${
            verifyData?.gateway_status ||
            "PENDING"
          }`
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to verify the payment."
          );

          setLoading(false);
        }
      }
    };

    void verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: "24px",

        background:
          "#f7f5ff",

        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",

          maxWidth: "560px",

          padding: "42px 32px",

          background: "#ffffff",

          borderRadius: "24px",

          textAlign: "center",

          boxShadow:
            "0 20px 60px rgba(40, 20, 100, 0.12)",

          border:
            "1px solid rgba(100, 70, 180, 0.12)",
        }}
      >
        {/* ==================================================
            STATUS ICON
        ================================================== */}

        <div
          style={{
            width: "72px",

            height: "72px",

            margin:
              "0 auto 20px",

            borderRadius:
              "50%",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            fontSize: "36px",

            background:
              error
                ? "#fff1f1"
                : "#f1edff",
          }}
        >
          {loading
            ? "…"
            : error
              ? "!"
              : "✓"}
        </div>

        {/* ==================================================
            TITLE
        ================================================== */}

        <h1
          style={{
            margin:
              "0 0 12px",

            fontSize:
              "28px",

            color:
              "#21144d",
          }}
        >
          {loading
            ? "Verifying Payment"
            : error
              ? "Payment Verification"
              : "Payment Successful"}
        </h1>

        {/* ==================================================
            MESSAGE
        ================================================== */}

        <p
          style={{
            margin:
              "0 auto",

            maxWidth:
              "460px",

            lineHeight:
              1.6,

            color:
              error
                ? "#a33"
                : "#5f5b6d",
          }}
        >
          {error || message}
        </p>

        {/* ==================================================
            BACK BUTTON
        ================================================== */}

        {!loading && (
          <button
            type="button"
            onClick={() =>
              navigate(
                "/app/marketplace"
              )
            }
            style={{
              marginTop:
                "24px",

              border: 0,

              borderRadius:
                "12px",

              padding:
                "13px 22px",

              background:
                "#5b2bcf",

              color:
                "#ffffff",

              fontWeight:
                700,

              cursor:
                "pointer",
            }}
          >
            Back to Marketplace
          </button>
        )}
      </div>
    </div>
  );
}