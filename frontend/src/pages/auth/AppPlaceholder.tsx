import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Download,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Search,
  Ticket,
  Users,
  X,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShoppingCart,
  Store,
  Upload,
  Trash2,
  Plus,
  Minus,
  Package,
  WalletCards,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import StudentCube3D from "../../components/three/StudentCube3D";
import AIChatbot from "../../components/ai/AIChatbot";
import AttendanceView from "../../components/attendance/AttendanceView";
import { load } from "@cashfreepayments/cashfree-js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const REQUEST_TIMEOUT_MS = 15000;

function getDisplayMessage(
  value: unknown,
  fallback = "Something went wrong."
): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value instanceof Error) {
    return value.message || fallback;
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => getDisplayMessage(item, ""))
      .filter(Boolean);

    return messages.length ? messages.join(", ") : fallback;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    for (const key of ["detail", "message", "error", "description"]) {
      const candidate = objectValue[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }

      if (candidate && typeof candidate === "object") {
        const nested = getDisplayMessage(candidate, "");
        if (nested) {
          return nested;
        }
      }
    }

    try {
      const serialized = JSON.stringify(value);
      return serialized && serialized !== "{}" ? serialized : fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function createRequestController() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  return { controller, timeoutId };
}

function getRequestError(
  error: unknown,
  fallback: string
): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The EduSphere server took too long to respond. Please try again.";
  }

  return getDisplayMessage(error, fallback);
}

type DashboardUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  profile_completed: boolean;
};

type StudentProfile = {
  user_id: number;
  email: string;
  full_name: string | null;
  profile_completed: boolean;
  is_active: boolean;

  student_profile_id: number;

  phone: string | null;

  institution_id: number;
  institution_name: string;
  university_code: string | null;

  enrollment_number: string;
  program: string;
  program_code: string | null;

  academic_year: string;
  current_year: number;
  semester: number;

  section: string;

  student_id: string;
  admission_year: number;
};

type DashboardResponse = {
  message: string;
  user: DashboardUser;
  student: StudentProfile;
};

type TimetableEntry = {
  timetable_id: number;
  institution_id: number;
  program_id: number;
  section_id: number;
  academic_year: string;
  current_year: number;
  day?: string | null;
  day_of_week?: string | null;
  start_time: string | number | null;
  end_time: string | number | null;
  room: string | null;
  course_id: number;
  course_name: string;
  course_code: string;
  course_semester: number;
  program_name: string;
  program_code: string;
  section_name: string;
  section_code: string;
  professor_id: number | null;
  professor_name: string | null;
};

type TimetableResponse = {
  student: {
    institution_id: number;
    program_id: number;
    program_name: string;
    program_code: string;
    section_id: number;
    section_name: string;
    section_code: string;
    academic_year: string;
    current_year: number;
    semester: number;
  };
  count: number;
  timetable: TimetableEntry[];
};

type StudentCourse = {
  course_id: number;
  course_name: string;
  course_code: string;
  semester: number;
  professor_names: string[];
  days: string[];
  class_count: number;
  rooms: string[];
};

type StudentEvent = {
  id: number;
  title: string;
  description: string | null;
  event_type: string | null;
  start_datetime: string;
  end_datetime: string;
  venue: string | null;
  organizer: string | null;
  registration_deadline: string | null;
  registration_link: string | null;
  target_program: string | null;
  target_stream: string | null;
  target_year: number | null;
  target_section: string | null;
  is_published: boolean | number;
  created_by: number;
  created_at: string;
  updated_at: string;
};

type EventsResponse = {
  count: number;
  events: StudentEvent[];
};

type StudentResult = {
  student_profile_id: number;
  student_id: string | null;
  enrollment_number: string | null;
  institution_id: number | null;
  program_id: number | null;
  program_name: string | null;
  program_code: string | null;
  academic_year: string | null;
  current_year: number | null;
  semester: number | null;
  section_id: number | null;
  section_name: string | null;
  section_code: string | null;
  result_id: number;
  exam_type: string;
  result_academic_year: string;
  result_semester: number;
  marks_obtained: number | string;
  maximum_marks: number | string;
  grade: string | null;
  grade_point: number | string | null;
  result_status: string;
  uploaded_by: number;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
  course_id: number;
  course_name: string;
  course_code: string;
};

type ResultsResponse = {
  count: number;
  results: StudentResult[];
};

type MarketplaceProduct = {
  product_id: number;
  seller_id: number;
  seller_name: string | null;
  institution_id: number;
  institution_name: string | null;
  name: string;
  description: string | null;
  preview_image_path?: string | null;
  category: string | null;
  product_type: "DIGITAL" | "PHYSICAL" | string;
  condition_type: string | null;
  price: number | string;
  quantity: number;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
};

type MarketplaceResponse = {
  count: number;
  products: MarketplaceProduct[];
};

type MarketplaceCartItem = {
  cart_item_id: number;
  product_id: number;
  quantity: number;
  seller_id: number;
  seller_name: string | null;
  name: string;
  description: string | null;
  category: string | null;
  product_type: string;
  condition_type: string | null;
  price: number | string;
  available_quantity: number;
  is_active: boolean | number;
  subtotal: number | string;
};

type MarketplaceCartResponse = {
  cart_id: number;
  count: number;
  items: MarketplaceCartItem[];
  total: number | string;
};

type MarketplaceDigitalFile = {
  attachment_id: number;
  product_id: number;
  product_name: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
};

type MarketplaceOrder = {
  order_id: number;
  institution_id: number;
  total_amount: number | string;
  status: string;
  created_at: string;
  updated_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_address?: string | null;
  digital_files?: MarketplaceDigitalFile[];
};

type MarketplaceOrdersResponse = {
  count: number;
  orders: MarketplaceOrder[];
};

type SellerOrder = {
  order_item_id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
  buyer_id: number;
  buyer_name: string | null;
  order_status: string;
  created_at: string;
};

type SellerOrdersResponse = {
  count: number;
  orders: SellerOrder[];
};

type MarketplacePaymentCreateResponse = {
  message: string;
  payment_id: number;
  order_id: number;
  gateway: string;
  gateway_order_id: string;
  payment_session_id: string;
  amount: number | string;
  currency: string;
  status: string;
  platform_fee_percent?: number | string;
  platform_fee_amount?: number | string;
  seller_net_amount?: number | string;
};



export default function AppPlaceholder() {
  const navigate = useNavigate();
  const { logout, user,  loading: authLoading, refreshUser } = useAuth();

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "timetable"
    | "courses"
    | "events"
    | "marketplace"
    | "results"
    | "attendance"
  >("dashboard");
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<StudentEvent | null>(null);

  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");

  const [marketplace, setMarketplace] =
    useState<MarketplaceResponse | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceCategory, setMarketplaceCategory] = useState("");
  const [marketplaceType, setMarketplaceType] = useState("");
  const [marketplaceCart, setMarketplaceCart] =
    useState<MarketplaceCartResponse | null>(null);
  const [marketplaceCartOpen, setMarketplaceCartOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] =
    useState<"ONLINE" | "COD">("ONLINE");
  const [shippingAddress, setShippingAddress] = useState("");

  const [marketplaceOrders, setMarketplaceOrders] =
    useState<MarketplaceOrdersResponse | null>(null);
  const [sellerOrders, setSellerOrders] =
    useState<SellerOrdersResponse | null>(null);
  const [marketplacePanel, setMarketplacePanel] = useState<
    "shop" | "sell" | "orders" | "sales"
  >("shop");
  const [showProductForm, setShowProductForm] = useState(false);
  const [marketplaceNotice, setMarketplaceNotice] = useState("");
  const [marketplaceBusy, setMarketplaceBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<MarketplaceProduct | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const { controller, timeoutId } = createRequestController();

    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.message ||
          "Unable to load your dashboard.";

        throw new Error(getDisplayMessage(message, "Unable to load your dashboard."));
      }

      setDashboard(data as DashboardResponse);
    } catch (err) {
      setError(
        getRequestError(
          err,
          "Unable to connect to the EduSphere API."
        )
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError("");

    try {
      const response = await fetch(`${API_BASE_URL}/events/`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.message ||
          "Unable to load your events.";
        throw new Error(getDisplayMessage(message, "Unable to load your timetable."));
      }

      if (!data || !Array.isArray(data.events)) {
        throw new Error("Invalid events response from server.");
      }

      setEvents(data as EventsResponse);
    } catch (err) {
      setEventsError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the events service."
      );
    } finally {
      setEventsLoading(false);
    }
  }, []);


  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    setResultsError("");

    try {
      const response = await fetch(`${API_BASE_URL}/results/`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(
            data?.detail ||
              data?.message ||
              "Unable to load your examination results."
          )
        );
      }

      if (!data || !Array.isArray(data.results)) {
        throw new Error("Invalid results response from server.");
      }

      setResults(data as ResultsResponse);
    } catch (err) {
      setResultsError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the results service."
      );
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    setMarketplaceError("");

    try {
      const params = new URLSearchParams();

      if (marketplaceCategory.trim()) {
        params.set("category", marketplaceCategory.trim());
      }

      if (marketplaceType.trim()) {
        params.set("product_type", marketplaceType.trim());
      }

      if (marketplaceSearch.trim()) {
        params.set("search", marketplaceSearch.trim());
      }

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/marketplace/${query ? `?${query}` : ""}`,
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(
            data?.detail ||
              data?.message ||
              "Unable to load marketplace products."
          )
        );
      }

      if (!data || !Array.isArray(data.products)) {
        throw new Error("Invalid marketplace response from server.");
      }

      setMarketplace(data as MarketplaceResponse);
    } catch (err) {
      setMarketplaceError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the marketplace."
      );
    } finally {
      setMarketplaceLoading(false);
    }
  }, [marketplaceCategory, marketplaceSearch, marketplaceType]);

  const loadMarketplaceCart = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/cart`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getDisplayMessage(data?.detail ?? data?.message, "Unable to load cart.")
        );
      }

      setMarketplaceCart(data as MarketplaceCartResponse);
    } catch (err) {
      setMarketplaceNotice(
        err instanceof Error ? err.message : "Unable to load your cart."
      );
    }
  }, []);

  useEffect(() => {
    const items = marketplaceCart?.items ?? [];
    const isAllPhysical =
      items.length > 0 &&
      items.every(
        (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
      );

    if (!isAllPhysical && checkoutPaymentMethod === "COD") {
      setCheckoutPaymentMethod("ONLINE");
    }
  }, [checkoutPaymentMethod, marketplaceCart]);

  const loadMarketplaceOrders = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/orders`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getDisplayMessage(data?.detail ?? data?.message, "Unable to load orders.")
        );
      }

      setMarketplaceOrders(data as MarketplaceOrdersResponse);
    } catch (err) {
      setMarketplaceNotice(
        err instanceof Error ? err.message : "Unable to load your orders."
      );
    }
  }, []);

  const loadSellerOrders = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/marketplace/seller/orders`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(
            data?.detail || data?.message || "Unable to load seller sales."
          )
        );
      }

      setSellerOrders(data as SellerOrdersResponse);
    } catch (err) {
      setMarketplaceNotice(
        err instanceof Error ? err.message : "Unable to load seller sales."
      );
    }
  }, []);

  const addMarketplaceToCart = useCallback(
    async (productId: number) => {
      setMarketplaceBusy(true);
      setMarketplaceNotice("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/marketplace/cart?product_id=${encodeURIComponent(
            productId
          )}&quantity=1`,
          {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json" },
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            String(
              data?.detail || data?.message || "Unable to add product to cart."
            )
          );
        }

        setMarketplaceNotice("Added to cart.");
        await loadMarketplaceCart();
      } catch (err) {
        setMarketplaceNotice(
          err instanceof Error ? err.message : "Unable to add to cart."
        );
      } finally {
        setMarketplaceBusy(false);
      }
    },
    [loadMarketplaceCart]
  );

  const updateMarketplaceCartItem = useCallback(
    async (productId: number, quantity: number) => {
      setMarketplaceBusy(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/marketplace/cart/items/${productId}?quantity=${encodeURIComponent(
            quantity
          )}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { Accept: "application/json" },
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            String(
              data?.detail || data?.message || "Unable to update cart item."
            )
          );
        }

        await loadMarketplaceCart();
      } catch (err) {
        setMarketplaceNotice(
          err instanceof Error ? err.message : "Unable to update cart."
        );
      } finally {
        setMarketplaceBusy(false);
      }
    },
    [loadMarketplaceCart]
  );

  const removeMarketplaceCartItem = useCallback(
    async (productId: number) => {
      setMarketplaceBusy(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/marketplace/cart/items/${productId}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: { Accept: "application/json" },
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            String(
              data?.detail || data?.message || "Unable to remove cart item."
            )
          );
        }

        await loadMarketplaceCart();
      } catch (err) {
        setMarketplaceNotice(
          err instanceof Error ? err.message : "Unable to remove cart item."
        );
      } finally {
        setMarketplaceBusy(false);
      }
    },
    [loadMarketplaceCart]
  );

  const checkoutMarketplace = useCallback(
    async (
      paymentMethod: "ONLINE" | "COD",
      deliveryAddress: string
    ) => {
      const institutionId =
        dashboard?.student.institution_id ??
        timetable?.student.institution_id;

      if (!institutionId) {
        setMarketplaceNotice(
          "Your institution information is not available yet."
        );
        return;
      }

      if (!marketplaceCart?.items.length) {
        setMarketplaceNotice("Your cart is empty.");
        return;
      }

      const hasDigital = marketplaceCart.items.some(
        (item) =>
          String(item.product_type).toUpperCase() === "DIGITAL"
      );

      if (paymentMethod === "COD" && hasDigital) {
        setMarketplaceNotice(
          "Cash on Delivery is available only when every cart item is physical."
        );
        return;
      }

      const hasPhysical = marketplaceCart.items.some(
        (item) =>
          String(item.product_type).toUpperCase() === "PHYSICAL"
      );

      if (hasPhysical && deliveryAddress.trim().length < 10) {
        setMarketplaceNotice(
          "Enter a valid delivery address for physical products."
        );
        return;
      }

      setMarketplaceBusy(true);
      setMarketplaceNotice("");

      try {
        // ------------------------------------------------------------
        // STEP 1: Create EduSphere marketplace order
        // ------------------------------------------------------------
        const checkoutResponse = await fetch(
          `${API_BASE_URL}/marketplace/checkout?institution_id=${encodeURIComponent(
            institutionId
          )}&payment_method=${encodeURIComponent(paymentMethod)}${
            hasPhysical
              ? `&shipping_address=${encodeURIComponent(
                  deliveryAddress.trim()
                )}`
              : ""
          }`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const checkoutData = await checkoutResponse
          .json()
          .catch(() => null);

        if (!checkoutResponse.ok) {
          throw new Error(
            String(
              checkoutData?.detail ||
                checkoutData?.message ||
                "Unable to create marketplace order."
            )
          );
        }

        const orderId = Number(checkoutData?.order_id);

        if (!Number.isFinite(orderId)) {
          throw new Error(
            "Marketplace order ID was not returned."
          );
        }

        // ------------------------------------------------------------
        // COD
        // ------------------------------------------------------------
        if (paymentMethod === "COD") {
          setMarketplaceNotice(
            `Cash on Delivery order #${orderId} placed successfully. Payment will remain pending until cash is collected.`
          );

          setMarketplacePanel("orders");
          setCheckoutPaymentMethod("ONLINE");
          setShippingAddress("");

          await loadMarketplaceCart();
          await loadMarketplaceOrders();

          setMarketplaceBusy(false);
          return;
        }

        // ------------------------------------------------------------
        // STEP 2: Create Cashfree payment session
        // ------------------------------------------------------------
        const paymentResponse = await fetch(
          `${API_BASE_URL}/marketplace/payments/`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: orderId,
            }),
          }
        );

        const paymentData =
          (await paymentResponse.json().catch(() => null)) as
            | MarketplacePaymentCreateResponse
            | { detail?: string; message?: string }
            | null;

        if (!paymentResponse.ok) {
          throw new Error(
            String(
              (paymentData as {
                detail?: string;
                message?: string;
              } | null)?.detail ||
                (paymentData as {
                  detail?: string;
                  message?: string;
                } | null)?.message ||
                "Unable to create Cashfree payment."
            )
          );
        }

        const payment =
          paymentData as MarketplacePaymentCreateResponse;

        if (!payment.payment_session_id) {
          throw new Error(
            "Cashfree payment session was not returned by the server."
          );
        }

        // ------------------------------------------------------------
        // STEP 3: Load Cashfree Sandbox SDK
        // ------------------------------------------------------------
        const cashfree = await load({
          mode: "sandbox",
        });

        if (!cashfree) {
          throw new Error(
            "Cashfree checkout could not be loaded."
          );
        }

        // ------------------------------------------------------------
        // STEP 4: Open Cashfree Sandbox Checkout
        // ------------------------------------------------------------
        const checkoutResult = (await cashfree.checkout({
          paymentSessionId: payment.payment_session_id,
          redirectTarget: "_self",
        })) as {
          error?: {
            message?: string;
          };
        };

        if (checkoutResult?.error) {
          throw new Error(
            checkoutResult.error.message ||
              "Cashfree checkout could not be started."
          );
        }

        // ------------------------------------------------------------
        // STEP 5: Verify payment on EduSphere backend
        //
        // Do NOT use gateway_order_id as gateway_payment_id.
        // The backend verifies the Cashfree order status server-side.
        // ------------------------------------------------------------
        const verifyResponse = await fetch(
          `${API_BASE_URL}/marketplace/payments/verify`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: orderId,
              gateway_order_id: payment.gateway_order_id,
            }),
          }
        );

        const verifyData = await verifyResponse
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

        const verificationStatus = String(
          verifyData?.status || ""
        ).toUpperCase();

        if (
          verificationStatus === "PAID" ||
          verificationStatus === "SUCCESS"
        ) {
          setMarketplaceNotice(
            `Payment successful. Order #${orderId} is confirmed.`
          );

          setMarketplacePanel("orders");
          setCheckoutPaymentMethod("ONLINE");
          setShippingAddress("");

          await loadMarketplaceCart();
          await loadMarketplaceOrders();
        } else {
          setMarketplaceNotice(
            `Payment is currently ${
              verificationStatus || "pending"
            }. Please check your orders shortly.`
          );
        }
      } catch (err) {
        setMarketplaceNotice(
          err instanceof Error
            ? err.message
            : "Unable to start marketplace payment."
        );
      } finally {
        setMarketplaceBusy(false);
      }
    },
    [
      dashboard,
      loadMarketplaceCart,
      loadMarketplaceOrders,
      marketplaceCart,
      timetable,
    ]
  );

  const loadTimetable = useCallback(async (day?: string) => {
    setTimetableLoading(true);
    setTimetableError("");

    const { controller, timeoutId } = createRequestController();

    try {
      const query = day ? `?day=${encodeURIComponent(day)}` : "";

      const response = await fetch(`${API_BASE_URL}/timetable/${query}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.message ||
          "Unable to load your timetable.";

        throw new Error(String(message));
      }

      if (!data || !Array.isArray(data.timetable)) {
        throw new Error("Invalid timetable response from server.");
      }

      setTimetable(data as TimetableResponse);
    } catch (err) {
      setTimetableError(
        getRequestError(
          err,
          "Unable to connect to the timetable service."
        )
      );
    } finally {
      window.clearTimeout(timeoutId);
      setTimetableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      setError(
        "Unable to verify your EduSphere session. Please check that the backend server is running."
      );
      return;
    }

    if (user.role !== "STUDENT") {
      setLoading(false);
      setError("");
      return;
    }

    loadDashboard();
  }, [authLoading, loadDashboard, user]);

  useEffect(() => {
    const styleId = "edusphere-student-dashboard-responsive";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media (max-width: 1050px) {
        .edusphere-app-shell { flex-direction: column !important; }
        .edusphere-sidebar {
          width: 100% !important;
          min-height: auto !important;
          position: relative !important;
        }
        .edusphere-navigation {
          flex-direction: row !important;
          flex-wrap: wrap !important;
        }
        .edusphere-nav-label { display: none !important; }
        .edusphere-sidebar-bottom { display: none !important; }
        .edusphere-main { padding: 28px 24px !important; }
        .edusphere-week-grid {
          grid-template-columns: repeat(7, minmax(180px, 1fr)) !important;
        }
      }

      @media (max-width: 760px) {
        .edusphere-main { padding: 22px 14px !important; }
        .edusphere-header {
          flex-direction: column !important;
          margin-bottom: 22px !important;
        }
        .edusphere-header-profile { width: 100% !important; box-sizing: border-box !important; }
        .edusphere-stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .edusphere-content-grid {
          grid-template-columns: 1fr !important;
        }
        .edusphere-module-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .edusphere-timetable-identity,
        .edusphere-schedule-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .edusphere-hero-card {
          align-items: flex-start !important;
          padding: 24px !important;
        }
        .edusphere-hero-cube {
          width: 170px !important;
          height: 170px !important;
          position: absolute !important;
          right: -25px !important;
          bottom: -20px !important;
          opacity: 0.65 !important;
        }
        .edusphere-hero-content {
          max-width: 75% !important;
        }
        .edusphere-week-grid {
          grid-template-columns: 1fr !important;
          overflow-x: visible !important;
        }
        .edusphere-day-column {
          min-width: 0 !important;
        }
      }

      /* ----------------------------------------------------------
         MOBILE TIMETABLE: prevent narrow cards from squeezing text
         ---------------------------------------------------------- */
      @media (max-width: 760px) {
        .edusphere-day-column {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          padding: 7px !important;
          box-sizing: border-box !important;
        }

        .edusphere-class-card {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          padding: 12px !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }

        .edusphere-class-time {
          width: 100% !important;
          min-width: 0 !important;
          font-size: 8px !important;
          line-height: 1.3 !important;
          margin-bottom: 8px !important;
        }

        .edusphere-class-title {
          min-width: 0 !important;
          max-width: 100% !important;
          margin: 0 !important;
          font-size: 16px !important;
          line-height: 1.22 !important;
          letter-spacing: -0.015em !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }

        .edusphere-class-meta {
          width: 100% !important;
          min-width: 0 !important;
          gap: 7px !important;
          margin-top: 10px !important;
          font-size: 8px !important;
          line-height: 1.35 !important;
        }

        .edusphere-class-meta > span {
          display: flex !important;
          align-items: flex-start !important;
          gap: 6px !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
        }

        .edusphere-class-meta > span svg {
          flex: 0 0 auto !important;
          margin-top: 1px !important;
        }
      }

      @media (max-width: 480px) {
        .edusphere-stats-grid,
        .edusphere-module-grid,
        .edusphere-timetable-identity,
        .edusphere-schedule-summary {
          grid-template-columns: 1fr !important;
        }
        .edusphere-hero-cube {
          width: 130px !important;
          height: 130px !important;
        }
        .edusphere-hero-content {
          max-width: 100% !important;
        }
        .edusphere-timetable-header {
          flex-direction: column !important;
        }
        .edusphere-timetable-header button {
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingShell}>
          <div style={styles.loadingOrb}>
            <GraduationCap size={34} />
          </div>

          <h1 style={styles.loadingTitle}>Loading EduSphere</h1>

          <p style={styles.loadingText}>
            Connecting to your academic workspace...
          </p>

          <div style={styles.loadingLine} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.errorShell}>
          <div style={styles.errorIcon}>!</div>

          <span style={styles.eyebrow}>EDUSPHERE API</span>

          <h1 style={styles.errorTitle}>
            Dashboard connection failed
          </h1>

          <p style={styles.errorText}>{error}</p>

          <div style={styles.errorActions}>
            <button
              type="button"
              onClick={async () => {
                setError("");
                setLoading(true);

                const refreshedUser = await refreshUser();

                if (!refreshedUser) {
                  setLoading(false);
                  setError(
                    "Unable to connect to the EduSphere backend. Please start the server and try again."
                  );
                }
              }}
              style={styles.primaryButton}
            >
              <RefreshCw size={17} />
              Retry connection
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.secondaryButton}
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const student = dashboard.student;
  const displayName =
    student.full_name ||
    dashboard.user.name ||
    "Student";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />
      <div style={styles.grid} />

      <div style={styles.appShell} className="edusphere-app-shell">
        {/* =====================================================
            SIDEBAR
        ====================================================== */}

        <aside style={styles.sidebar} className="edusphere-sidebar">
          <div className="student-brand">
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              className="student-brand-logo"
            />

            <div className="student-brand-text">
              <strong>EDUSPHERE</strong>
              <span>Academic Intelligence</span>
            </div>
          </div>

          <nav style={styles.navigation} className="edusphere-navigation">
            <div style={styles.navLabel} className="edusphere-nav-label">WORKSPACE</div>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "dashboard"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("dashboard");
              }}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "timetable"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("timetable");
                if (!timetable) {
                  loadTimetable();
                }
              }}
            >
              <CalendarDays size={18} />
              Timetable
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "courses"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("courses");
                if (!timetable) {
                  loadTimetable();
                }
              }}
            >
              <BookOpen size={18} />
              Courses
            </button>
            <button
              type="button"
              style={styles.navItem}
              onClick={() => {
                navigate("/app/library");
              }}
            >
              <BookOpen size={18} />
              Library
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "events"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("events");
                if (!events) {
                  loadEvents();
                }
              }}
            >
              <CalendarDays size={18} />
              Events
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "marketplace"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("marketplace");
                if (!marketplace) {
                  loadMarketplace();
                }
                if (!marketplaceCart) {
                  loadMarketplaceCart();
                }
              }}
            >
              <Store size={18} />
              Marketplace
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "results"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => {
                setActiveTab("results");
                if (!results) {
                  loadResults();
                }
              }}
            >
              <GraduationCap size={18} />
              Results
            </button>

            <button
              type="button"
              style={{
                ...styles.navItem,
                ...(activeTab === "attendance"
                  ? styles.navItemActive
                  : {}),
              }}
              onClick={() => setActiveTab("attendance")}
            >
              <UserRound size={18} />
              Attendance
            </button>

            <button
              type="button"
              style={styles.navItem}
              onClick={() => navigate("/auth/profile/student")}
            >
              <UserRound size={18} />
              Profile
            </button>
          </nav>

          <div style={styles.sidebarBottom} className="edusphere-sidebar-bottom">
            <div style={styles.connectionStatus}>
              <span style={styles.connectionDot} />

              <div>
                <div style={styles.connectionTitle}>
                  API CONNECTED
                </div>

                <div style={styles.connectionSubtitle}>
                  FastAPI + MySQL
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutButton}
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </aside>

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <main style={styles.main} className="edusphere-main">
          <header style={styles.header} className="edusphere-header">
            <div>
              <span style={styles.eyebrow}>STUDENT COMMAND CENTER</span>

              <h1 style={styles.pageTitle}>
                Welcome back,{" "}
                <span style={styles.gradientText}>
                  {displayName.split(" ")[0]}
                </span>
              </h1>

              <p style={styles.pageDescription}>
                Your academic workspace is synchronized with EduSphere.
              </p>
            </div>

            <div style={styles.headerProfile} className="edusphere-header-profile">
              <div style={styles.avatar}>
                {initials || "ST"}
              </div>

              <div>
                <div style={styles.headerName}>{displayName}</div>
                <div style={styles.headerEmail}>
                  {dashboard.user.email}
                </div>
              </div>
            </div>
          </header>

          {activeTab === "dashboard" ? (
            <>
          {/* ===================================================
              HERO PROFILE CARD
          ==================================================== */}

          <section style={styles.heroCard} className="edusphere-hero-card">
            <div style={styles.heroContent} className="edusphere-hero-content">
              <span style={styles.cardEyebrow}>
                ACADEMIC IDENTITY
              </span>

              <h2 style={styles.heroTitle}>
                {student.program}
              </h2>

              <p style={styles.heroSubtitle}>
                {student.institution_name}
              </p>

              <div style={styles.heroMetaRow}>
                <span style={styles.metaPill}>
                  {student.section}
                </span>

                <span style={styles.metaPill}>
                  Year {student.current_year}
                </span>

                <span style={styles.metaPill}>
                  Semester {student.semester}
                </span>

                <span style={styles.metaPill}>
                  {student.academic_year}
                </span>
              </div>
            </div>

            <div style={styles.heroCube} className="edusphere-hero-cube">
              <StudentCube3D />
            </div>
          </section>

          {/* ===================================================
              DATA CARDS
          ==================================================== */}

          <section style={styles.statsGrid} className="edusphere-stats-grid">
            <DataCard
              label="Student ID"
              value={student.student_id}
              icon={<UserRound size={20} />}
            />

            <DataCard
              label="Enrollment"
              value={student.enrollment_number}
              icon={<GraduationCap size={20} />}
            />

            <DataCard
              label="Academic Year"
              value={student.academic_year}
              icon={<CalendarDays size={20} />}
            />

            <DataCard
              label="Semester"
              value={`Semester ${student.semester}`}
              icon={<BookOpen size={20} />}
            />
          </section>

          {/* ===================================================
              INFORMATION GRID
          ==================================================== */}

          <section style={styles.contentGrid} className="edusphere-content-grid">
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <span style={styles.cardEyebrow}>
                    PROFILE DATA
                  </span>

                  <h3 style={styles.panelTitle}>
                    Academic profile
                  </h3>
                </div>

                <UserRound size={18} />
              </div>

              <div style={styles.infoList}>
                <InfoRow
                  label="Full name"
                  value={student.full_name || "Not provided"}
                />

                <InfoRow
                  label="Email"
                  value={student.email}
                />

                <InfoRow
                  label="Phone"
                  value={student.phone || "Not provided"}
                />

                <InfoRow
                  label="Institution"
                  value={student.institution_name}
                />

                <InfoRow
                  label="University code"
                  value={student.university_code || "—"}
                />

                <InfoRow
                  label="Program"
                  value={student.program}
                />

                <InfoRow
                  label="Stream"
                  value={student.program_code || "—"}
                />
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <span style={styles.cardEyebrow}>
                    ENROLLMENT
                  </span>

                  <h3 style={styles.panelTitle}>
                    Academic status
                  </h3>
                </div>

                <GraduationCap size={18} />
              </div>

              <div style={styles.statusBlock}>
                <div style={styles.statusIcon}>
                  ✓
                </div>

                <div>
                  <div style={styles.statusTitle}>
                    Profile verified
                  </div>

                  <div style={styles.statusText}>
                    Your student profile is complete and active.
                  </div>
                </div>
              </div>

              <div style={styles.infoList}>
                <InfoRow
                  label="Student ID"
                  value={student.student_id}
                />

                <InfoRow
                  label="Enrollment number"
                  value={student.enrollment_number}
                />

                <InfoRow
                  label="Admission year"
                  value={String(student.admission_year)}
                />

                <InfoRow
                  label="Current year"
                  value={`Year ${student.current_year}`}
                />

                <InfoRow
                  label="Semester"
                  value={`Semester ${student.semester}`}
                />

                <InfoRow
                  label="Section"
                  value={student.section}
                />
              </div>
            </div>
          </section>

          {/* ===================================================
              NEXT MODULES
          ==================================================== */}

          <section style={styles.modulesPanel}>
            <div>
              <span style={styles.cardEyebrow}>
                ACADEMIC MODULES
              </span>

              <h3 style={styles.panelTitle}>
                Your EduSphere workspace
              </h3>

              <p style={styles.modulesDescription}>
                These modules will be connected to their respective
                FastAPI/MySQL endpoints in the next implementation
                steps.
              </p>
            </div>

            <div style={styles.moduleGrid} className="edusphere-module-grid">
              <ModuleCard
                icon={<CalendarDays size={18} />}
                title="Timetable"
                description="View your section schedule."
                onClick={() => {
                  setActiveTab("timetable");
                  if (!timetable) {
                    loadTimetable();
                  }
                }}
              />

              <ModuleCard
                icon={<BookOpen size={18} />}
                title="Courses"
                description="View your current semester courses."
                onClick={() => {
                  setActiveTab("courses");
                  if (!timetable) {
                    loadTimetable();
                  }
                }}
              />

              <ModuleCard
                icon={<GraduationCap size={18} />}
                title="Results"
                description="View your examination results."
                onClick={() => {
                  setActiveTab("results");
                  if (!results) {
                    loadResults();
                  }
                }}
              />

              <ModuleCard
                icon={<UserRound size={18} />}
                title="Attendance"
                description="Track your attendance."
                onClick={() => {
                  setActiveTab("attendance");
                }}
              />
            </div>
          </section>
            </>
          ) : activeTab === "timetable" ? (
            <TimetableView
              timetable={timetable}
              loading={timetableLoading}
              error={timetableError}
              selectedDay={selectedDay}
              onDayChange={(day) => {
                setSelectedDay(day);
                loadTimetable(day || undefined);
              }}
              onRefresh={() => loadTimetable(selectedDay || undefined)}
            />
          ) : activeTab === "courses" ? (
            <CoursesView
              timetable={timetable}
              loading={timetableLoading}
              error={timetableError}
              search={courseSearch}
              onSearchChange={setCourseSearch}
              onRefresh={() => loadTimetable()}
            />
          ) : activeTab === "events" ? (
            <EventsView
              events={events}
              loading={eventsLoading}
              error={eventsError}
              search={eventSearch}
              onSearchChange={setEventSearch}
              onRefresh={loadEvents}
              onSelectEvent={setSelectedEvent}
            />
          ) : activeTab === "results" ? (
            <ResultsView
              results={results}
              loading={resultsLoading}
              error={resultsError}
              onRefresh={loadResults}
            />
          ) : activeTab === "attendance" ? (
            <div className="edusphere-attendance-shell">
              <AttendanceView studentId={student.user_id} />
            </div>
          ) : (
            <MarketplaceView
              marketplace={marketplace}
              loading={marketplaceLoading}
              error={marketplaceError}
              search={marketplaceSearch}
              category={marketplaceCategory}
              productType={marketplaceType}
              onSearchChange={setMarketplaceSearch}
              onCategoryChange={setMarketplaceCategory}
              onProductTypeChange={setMarketplaceType}
              onRefresh={loadMarketplace}
              cart={marketplaceCart}
              cartOpen={marketplaceCartOpen}
              onOpenCart={() => {
                setMarketplaceCartOpen(true);
                loadMarketplaceCart();
              }}
              onCloseCart={() => setMarketplaceCartOpen(false)}
              onAddToCart={addMarketplaceToCart}
              onUpdateCart={updateMarketplaceCartItem}
              onRemoveCart={removeMarketplaceCartItem}
              onCheckout={checkoutMarketplace}
              paymentMethod={checkoutPaymentMethod}
              onPaymentMethodChange={setCheckoutPaymentMethod}
              shippingAddress={shippingAddress}
              onShippingAddressChange={setShippingAddress}
              orders={marketplaceOrders}
              sellerOrders={sellerOrders}
              panel={marketplacePanel}
              onPanelChange={(panel) => {
                setMarketplacePanel(panel);
                if (panel === "orders" && !marketplaceOrders) {
                  loadMarketplaceOrders();
                }
                if (panel === "sales" && !sellerOrders) {
                  loadSellerOrders();
                }
              }}
              onCreateProduct={() => setShowProductForm(true)}
              notice={marketplaceNotice}
              busy={marketplaceBusy}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
              showProductForm={showProductForm}
              onCloseProductForm={() => setShowProductForm(false)}
              institutionId={dashboard?.student.institution_id ?? timetable?.student.institution_id ?? null}
              onProductCreated={() => {
                setShowProductForm(false);
                loadMarketplace();
              }}
            />
          )}

          {selectedEvent && (
            <EventDetailModal
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}

          <footer style={styles.footer}>
            <div style={styles.footerBrand}>
              <img
                src="/edusphere-logo.jpeg"
                alt="EduSphere"
                style={styles.footerLogo}
              />
              <div>
                <div style={styles.footerBrandName}>EduSphere</div>
                <div style={styles.footerBrandSubtitle}>
                  ACADEMIC INTELLIGENCE PLATFORM
                </div>
              </div>
            </div>

            <div style={styles.footerMeta}>
              <span>FastAPI + MySQL</span>
              <span style={styles.footerDivider}>•</span>
              <span>User #{dashboard.user.id}</span>
            </div>
          </footer>

          <AIChatbot />
        </main>
      </div>
    </div>
  );
}

/* =============================================================
   DATA CARD
============================================================= */

function DataCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={styles.dataCard}>
      <div style={styles.dataCardIcon}>{icon}</div>

      <div style={styles.dataCardLabel}>{label}</div>

      <div style={styles.dataCardValue}>{value}</div>
    </div>
  );
}

/* =============================================================
   INFO ROW
============================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>

      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

/* =============================================================
   MODULE CARD
============================================================= */

function ModuleCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      style={styles.moduleCard}
      onClick={onClick}
      disabled={!onClick}
    >
      <div style={styles.moduleIcon}>{icon}</div>

      <div>
        <div style={styles.moduleTitle}>{title}</div>

        <div style={styles.moduleDescription}>
          {description}
        </div>
      </div>

      <ArrowRight
        size={17}
        style={styles.moduleArrow}
      />
    </button>
  );
}




/* =============================================================
   RESULTS VIEW
============================================================= */

function ResultsView({
  results,
  loading,
  error,
  onRefresh,
}: {
  results: ResultsResponse | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const grouped = (results?.results ?? []).reduce<Record<string, StudentResult[]>>(
    (groups, result) => {
      const key = `${result.result_academic_year} • Semester ${result.result_semester}`;
      (groups[key] ??= []).push(result);
      return groups;
    },
    {}
  );

  const totalMarks = (results?.results ?? []).reduce(
    (sum, result) => sum + Number(result.marks_obtained || 0),
    0
  );
  const totalMaximum = (results?.results ?? []).reduce(
    (sum, result) => sum + Number(result.maximum_marks || 0),
    0
  );
  const percentage = totalMaximum > 0 ? (totalMarks / totalMaximum) * 100 : null;
  const passed = (results?.results ?? []).filter(
    (result) => String(result.result_status).toUpperCase() === "PASS"
  ).length;

  return (
    <section>
      <div style={styles.timetableHeader}>
        <div>
          <span style={styles.eyebrow}>ACADEMIC PERFORMANCE</span>
          <h2 style={styles.timetableTitle}>Examination Results</h2>
          <p style={styles.timetableDescription}>
            Your published examination results from the EduSphere results service.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{ ...styles.primaryButton, opacity: loading ? 0.6 : 1 }}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div style={styles.timetableError}>
          <div style={styles.errorIcon}>!</div>
          <div>
            <strong>Results unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && !results ? (
        <div style={styles.timetableEmpty}>
          <RefreshCw size={28} style={styles.timetableSpinner} />
          <h3 style={styles.timetableEmptyTitle}>Loading results</h3>
          <p style={styles.timetableEmptyText}>
            Synchronizing your published academic performance...
          </p>
        </div>
      ) : !results || results.count === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <GraduationCap size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO PUBLISHED RESULTS</span>
          <h3 style={styles.timetableEmptyTitle}>Results are not available yet</h3>
          <p style={styles.timetableEmptyText}>
            No examination results have been published for your student profile.
            Once a professor or administrator publishes a result, it will appear here automatically.
          </p>
          <span style={styles.emptyHint}>
            This view uses live examination_results records from FastAPI + MySQL.
          </span>
        </div>
      ) : (
        <>
          <div style={styles.statsGrid} className="edusphere-stats-grid">
            <DataCard
              label="Published Results"
              value={String(results.count)}
              icon={<GraduationCap size={20} />}
            />
            <DataCard
              label="Passed"
              value={String(passed)}
              icon={<BookOpen size={20} />}
            />
            <DataCard
              label="Marks"
              value={`${totalMarks} / ${totalMaximum}`}
              icon={<Clock3 size={20} />}
            />
            <DataCard
              label="Percentage"
              value={percentage === null ? "—" : `${percentage.toFixed(2)}%`}
              icon={<GraduationCap size={20} />}
            />
          </div>

          {Object.entries(grouped).map(([semesterLabel, semesterResults]) => (
            <section key={semesterLabel} style={{ ...styles.panel, marginBottom: 16 }}>
              <div style={styles.panelHeader}>
                <div>
                  <span style={styles.cardEyebrow}>RESULT SESSION</span>
                  <h3 style={styles.panelTitle}>{semesterLabel}</h3>
                </div>
                <GraduationCap size={21} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {semesterResults.map((result) => {
                  const marks = Number(result.marks_obtained);
                  const maximum = Number(result.maximum_marks);
                  const percentageForRow = maximum > 0 ? (marks / maximum) * 100 : null;
                  const status = String(result.result_status || "").toUpperCase();

                  return (
                    <div
                      key={result.result_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(180px, 1.6fr) repeat(4, minmax(85px, 0.7fr))",
                        gap: 14,
                        alignItems: "center",
                        padding: "15px 16px",
                        borderRadius: 14,
                        background: "rgba(2,6,23,0.38)",
                        border: "1px solid rgba(148,163,184,0.08)",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#f8fafc", fontSize: 12 }}>{result.course_name}</strong>
                        <div style={{ color: "#64748b", fontSize: 9, marginTop: 4 }}>
                          {result.course_code} · {result.exam_type}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 8 }}>MARKS</div>
                        <strong style={{ color: "#e2e8f0", fontSize: 12 }}>
                          {marks} / {maximum}
                        </strong>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 8 }}>GRADE</div>
                        <strong style={{ color: "#a5b4fc", fontSize: 13 }}>
                          {result.grade || "—"}
                        </strong>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", fontSize: 8 }}>POINT</div>
                        <strong style={{ color: "#e2e8f0", fontSize: 12 }}>
                          {result.grade_point ?? "—"}
                        </strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 8px",
                            borderRadius: 8,
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: "0.08em",
                            color: status === "PASS" ? "#6ee7b7" : "#fda4af",
                            background: status === "PASS" ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
                            border: status === "PASS" ? "1px solid rgba(52,211,153,0.12)" : "1px solid rgba(251,113,133,0.12)",
                          }}
                        >
                          {status || "—"}
                        </span>
                        <div style={{ color: "#475569", fontSize: 8, marginTop: 5 }}>
                          {percentageForRow === null ? "—" : `${percentageForRow.toFixed(1)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

/* =============================================================
   MARKETPLACE VIEW
============================================================= */

function MarketplaceView({
  marketplace,
  loading,
  error,
  search,
  category,
  productType,
  onSearchChange,
  onCategoryChange,
  onProductTypeChange,
  onRefresh,
  cart,
  cartOpen,
  onOpenCart,
  onCloseCart,
  onAddToCart,
  onUpdateCart,
  onRemoveCart,
  onCheckout,
  paymentMethod,
  onPaymentMethodChange,
  shippingAddress,
  onShippingAddressChange,
  orders,
  sellerOrders,
  panel,
  onPanelChange,
  onCreateProduct,
  notice,
  busy,
  selectedProduct,
  onSelectProduct,
  showProductForm,
  onCloseProductForm,
  institutionId,
  onProductCreated,
}: {
  marketplace: MarketplaceResponse | null;
  loading: boolean;
  error: string;
  search: string;
  category: string;
  productType: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductTypeChange: (value: string) => void;
  onRefresh: () => void;
  cart: MarketplaceCartResponse | null;
  cartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onAddToCart: (productId: number) => void;
  onUpdateCart: (productId: number, quantity: number) => void;
  onRemoveCart: (productId: number) => void;
  onCheckout: (paymentMethod: "ONLINE" | "COD", shippingAddress: string) => void;
  paymentMethod: "ONLINE" | "COD";
  onPaymentMethodChange: (method: "ONLINE" | "COD") => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
  orders: MarketplaceOrdersResponse | null;
  sellerOrders: SellerOrdersResponse | null;
  panel: "shop" | "sell" | "orders" | "sales";
  onPanelChange: (
    panel: "shop" | "sell" | "orders" | "sales"
  ) => void;
  onCreateProduct: () => void;
  notice: unknown;
  busy: boolean;
  selectedProduct: MarketplaceProduct | null;
  onSelectProduct: (product: MarketplaceProduct | null) => void;
  showProductForm: boolean;
  onCloseProductForm: () => void;
  institutionId: number | null;
  onProductCreated: () => void;
}) {
  const products = marketplace?.products ?? [];

  const categories = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean))
  ) as string[];

  const visibleProducts = products.filter((product) => {
    if (
      category &&
      String(product.category || "").toLowerCase() !== category.toLowerCase()
    ) {
      return false;
    }

    if (productType && product.product_type !== productType) {
      return false;
    }

    return true;
  });

  return (
    <section>
      <div style={styles.timetableHeader} className="edusphere-timetable-header">
        <div>
          <span style={styles.eyebrow}>CAMPUS COMMERCE</span>
          <h2 style={styles.timetableTitle}>Marketplace</h2>
          <p style={styles.timetableDescription}>
            Buy and sell academic and campus products with secure checkout.
          </p>
        </div>

        <div style={styles.marketplaceHeaderActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onPanelChange("orders")}
          >
            <Package size={16} />
            Orders
          </button>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onPanelChange("sales")}
          >
            <WalletCards size={16} />
            My Sales
          </button>

          <button
            type="button"
            style={styles.cartButton}
            onClick={onOpenCart}
          >
            <ShoppingCart size={16} />
            Cart
            <span style={styles.cartCount}>
              {cart?.count ?? 0}
            </span>
          </button>
        </div>
      </div>

      <div style={styles.marketplaceTabs}>
        {[
          ["shop", "Browse"],
          ["sell", "Sell"],
          ["orders", "Orders"],
          ["sales", "My Sales"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              onPanelChange(
                value as "shop" | "sell" | "orders" | "sales"
              )
            }
            style={{
              ...styles.marketplaceTab,
              ...(panel === value ? styles.marketplaceTabActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {Boolean(notice) && (
        <div style={styles.marketplaceNotice}>{getDisplayMessage(notice)}</div>
      )}

      {panel === "shop" && (
        <>
          <div style={styles.marketplaceToolbar}>
            <div style={styles.courseSearchBox}>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search products..."
                style={styles.courseSearchInput}
              />
            </div>

            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              style={styles.marketplaceSelect}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={productType}
              onChange={(event) => onProductTypeChange(event.target.value)}
              style={styles.marketplaceSelect}
            >
              <option value="">All types</option>
              <option value="DIGITAL">Digital</option>
              <option value="PHYSICAL">Physical</option>
            </select>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={styles.secondaryButton}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {error ? (
            <div style={styles.timetableError}>
              <div style={styles.errorIcon}>!</div>
              <div>
                <strong>Marketplace unavailable</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : loading && !marketplace ? (
            <div style={styles.timetableEmpty}>
              <RefreshCw size={28} style={styles.timetableSpinner} />
              <span style={styles.cardEyebrow}>LIVE MARKETPLACE DATA</span>
              <h3>Loading marketplace</h3>
              <p>Fetching active listings from EduSphere.</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div style={styles.timetableEmpty}>
              <div style={styles.emptyCalendarIcon}>
                <Store size={28} />
              </div>
              <span style={styles.cardEyebrow}>NO ACTIVE LISTINGS</span>
              <h3 style={styles.timetableEmptyTitle}>
                Marketplace is empty
              </h3>
              <p style={styles.timetableEmptyText}>
                No active products match your current filters.
              </p>
            </div>
          ) : (
            <div
              style={styles.marketplaceGrid}
              className="edusphere-marketplace-grid"
            >
              {visibleProducts.map((product) => (
                <MarketplaceProductCard
                  key={product.product_id}
                  product={product}
                  busy={busy}
                  onSelect={() => onSelectProduct(product)}
                  onAddToCart={() => onAddToCart(product.product_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {panel === "sell" && (
        <div style={styles.sellPanel}>
          <div>
            <span style={styles.eyebrow}>SELLER SPACE</span>
            <h3 style={styles.sellTitle}>List a product</h3>
            <p style={styles.sellDescription}>
              Completed EduSphere users can create their own marketplace
              listings. Digital products can include private downloadable
              files.
            </p>
          </div>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={onCreateProduct}
          >
            <Plus size={16} />
            Create Listing
          </button>
        </div>
      )}

      {panel === "orders" && (
        <MarketplaceOrders orders={orders} />
      )}

      {panel === "sales" && (
        <MarketplaceSales orders={sellerOrders} />
      )}

      {selectedProduct && (
        <MarketplaceProductModal
          product={selectedProduct}
          onClose={() => onSelectProduct(null)}
          onAddToCart={() => {
            onAddToCart(selectedProduct.product_id);
            onSelectProduct(null);
          }}
          busy={busy}
        />
      )}

      {cartOpen && cart && (
        <MarketplaceCartModal
          cart={cart}
          onClose={onCloseCart}
          onUpdate={onUpdateCart}
          onRemove={onRemoveCart}
          onCheckout={onCheckout}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={onPaymentMethodChange}
          shippingAddress={shippingAddress}
          onShippingAddressChange={onShippingAddressChange}
          busy={busy}
        />
      )}

      {showProductForm && institutionId && (
        <MarketplaceProductForm
          institutionId={institutionId}
          onClose={onCloseProductForm}
          onCreated={onProductCreated}
        />
      )}
    </section>
  );
}

function MarketplaceProductCard({
  product,
  onSelect,
  onAddToCart,
  busy,
}: {
  product: MarketplaceProduct;
  onSelect: () => void;
  onAddToCart: () => void;
  busy: boolean;
}) {
  const price = Number(product.price);

  return (
    <article style={styles.marketplaceProductCard}>
      <button
        type="button"
        style={styles.marketplaceProductMain}
        onClick={onSelect}
      >
        {product.preview_image_path && (
          <img
            src={`${API_BASE_URL}/marketplace/${product.product_id}/preview`}
            alt={`${product.name} preview`}
            loading="lazy"
            style={{
              width: "100%",
              height: 150,
              objectFit: "cover",
              borderRadius: 12,
              marginBottom: 10,
              display: "block",
            }}
          />
        )}

        <div style={styles.marketplaceProductIcon}>
          {product.product_type === "DIGITAL" ? (
            <BookOpen size={22} />
          ) : (
            <Package size={22} />
          )}
        </div>

        <div style={styles.marketplaceProductBadgeRow}>
          <span style={styles.marketplaceTypeBadge}>
            {product.product_type}
          </span>
          {product.category && (
            <span style={styles.marketplaceCategoryBadge}>
              {product.category}
            </span>
          )}
        </div>

        <h3 style={styles.marketplaceProductTitle}>{product.name}</h3>

        <p style={styles.marketplaceProductDescription}>
          {product.description
            ? product.description.length > 105
              ? `${product.description.slice(0, 105)}…`
              : product.description
            : "No description provided."}
        </p>

        <div style={styles.marketplaceProductSeller}>
          <UserRound size={13} />
          <span>{product.seller_name || "EduSphere seller"}</span>
        </div>

        <div style={styles.marketplaceProductBottom}>
          <strong style={styles.marketplacePrice}>
            ₹{Number.isFinite(price) ? price.toFixed(2) : "0.00"}
          </strong>
          <span style={styles.marketplaceStock}>
            {product.product_type === "DIGITAL"
              ? "Digital delivery"
              : `${product.quantity} available`}
          </span>
        </div>
      </button>

      <button
        type="button"
        style={styles.addToCartButton}
        onClick={onAddToCart}
        disabled={busy || product.quantity <= 0}
      >
        <ShoppingCart size={15} />
        {product.quantity <= 0 ? "Out of stock" : "Add to cart"}
      </button>
    </article>
  );
}

function MarketplaceProductModal({
  product,
  onClose,
  onAddToCart,
  busy,
}: {
  product: MarketplaceProduct;
  onClose: () => void;
  onAddToCart: () => void;
  busy: boolean;
}) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.eventModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>
              {product.product_type}
            </span>
            <h2 style={styles.modalTitle}>{product.name}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
            aria-label="Close product"
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <p style={styles.modalDescription}>
            {product.description || "No description provided."}
          </p>

          <div style={styles.modalInfoGrid}>
            <div style={styles.modalInfoCard}>
              <WalletCards size={17} />
              <div>
                <span style={styles.modalInfoLabel}>PRICE</span>
                <strong style={styles.modalInfoValue}>
                  ₹{Number(product.price).toFixed(2)}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <UserRound size={17} />
              <div>
                <span style={styles.modalInfoLabel}>SELLER</span>
                <strong style={styles.modalInfoValue}>
                  {product.seller_name || "EduSphere seller"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Store size={17} />
              <div>
                <span style={styles.modalInfoLabel}>CATEGORY</span>
                <strong style={styles.modalInfoValue}>
                  {product.category || "Uncategorized"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Package size={17} />
              <div>
                <span style={styles.modalInfoLabel}>AVAILABILITY</span>
                <strong style={styles.modalInfoValue}>
                  {product.product_type === "DIGITAL"
                    ? "Digital"
                    : `${product.quantity} available`}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={onAddToCart}
            disabled={busy || product.quantity <= 0}
          >
            <ShoppingCart size={16} />
            {product.quantity <= 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceCartModal({
  cart,
  onClose,
  onUpdate,
  onRemove,
  onCheckout,
  busy,
  paymentMethod,
  onPaymentMethodChange,
  shippingAddress,
  onShippingAddressChange,
}: {
  cart: MarketplaceCartResponse;
  onClose: () => void;
  onUpdate: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: (paymentMethod: "ONLINE" | "COD", shippingAddress: string) => void;
  busy: boolean;
  paymentMethod: "ONLINE" | "COD";
  onPaymentMethodChange: (method: "ONLINE" | "COD") => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
}) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.cartModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>BUYER CART</span>
            <h2 style={styles.modalTitle}>Your Cart</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.cartBody}>
          {cart.items.length === 0 ? (
            <div style={styles.timetableEmpty}>
              <ShoppingCart size={30} />
              <h3 style={styles.timetableEmptyTitle}>Cart is empty</h3>
              <p style={styles.timetableEmptyText}>
                Add a marketplace product to begin checkout.
              </p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.cart_item_id} style={styles.cartItem}>
                <div style={styles.cartItemMain}>
                  <strong>{item.name}</strong>
                  <span>
                    {item.seller_name || "Seller"} · ₹
                    {Number(item.price).toFixed(2)}
                  </span>
                </div>

                <div style={styles.cartItemActions}>
                  <button
                    type="button"
                    style={styles.quantityButton}
                    onClick={() =>
                      onUpdate(
                        item.product_id,
                        Math.max(1, item.quantity - 1)
                      )
                    }
                    disabled={busy}
                  >
                    <Minus size={13} />
                  </button>

                  <span style={styles.quantityValue}>{item.quantity}</span>

                  <button
                    type="button"
                    style={styles.quantityButton}
                    onClick={() =>
                      onUpdate(
                        item.product_id,
                        Math.min(
                          item.available_quantity,
                          item.quantity + 1
                        )
                      )
                    }
                    disabled={
                      busy ||
                      item.quantity >= item.available_quantity
                    }
                  >
                    <Plus size={13} />
                  </button>

                  <button
                    type="button"
                    style={styles.removeCartButton}
                    onClick={() => onRemove(item.product_id)}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && cart.items.every(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && (
            <div
              style={{
                width: "100%",
                margin: 0,
                padding: "10px 20px",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange("ONLINE")}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: paymentMethod === "ONLINE" ? "1px solid #818cf8" : "1px solid #334155",
                    background: paymentMethod === "ONLINE" ? "#1e1b4b" : "#0f172a",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  Online · Cashfree
                </button>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange("COD")}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: paymentMethod === "COD" ? "1px solid #818cf8" : "1px solid #334155",
                    background: paymentMethod === "COD" ? "#1e1b4b" : "#0f172a",
                    color: "#e2e8f0",
                    fontWeight: 800,
                  }}
                >
                  Cash on Delivery
                </button>
              </div>
              {paymentMethod === "COD" && (
                <textarea
                  value={shippingAddress}
                  onChange={(event) => onShippingAddressChange(event.target.value)}
                  placeholder="Delivery address (house/building, street, area, city, PIN)"
                  rows={3}
                  disabled={busy}
                  style={{ ...styles.formTextarea, width: "100%", boxSizing: "border-box" }}
                />
              )}
            </div>
          )}
          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
          ) && !(
            cart.items.every(
              (item) => String(item.product_type).toUpperCase() === "PHYSICAL"
            )
          ) && (
            <div style={{ width: "100%", marginBottom: 12 }}>
              <textarea
                value={shippingAddress}
                onChange={(event) => onShippingAddressChange(event.target.value)}
                placeholder="Delivery address (house/building, street, area, city, PIN)"
                rows={3}
                disabled={busy}
                style={{ ...styles.formTextarea, width: "100%", boxSizing: "border-box" }}
              />
            </div>
          )}
          {cart.items.some(
            (item) => String(item.product_type).toUpperCase() === "DIGITAL"
          ) && (
            <div
              style={{
                width: "100%",
                margin: 0,
                padding: "8px 20px",
                boxSizing: "border-box",
                color: "#94a3b8",
                fontSize: 11,
                borderTop: "1px solid rgba(148,163,184,0.07)",
                borderBottom: "1px solid rgba(148,163,184,0.07)",
              }}
            >
              Digital products require online payment. COD is unavailable for digital
              items.
            </div>
          )}

        <div style={styles.cartFooter}>
          <div>
            <span style={styles.modalInfoLabel}>BUYER PAYS</span>
            <strong style={styles.cartTotal}>
              ₹{Number(cart.total).toFixed(2)}
            </strong>
            <span style={{ display: "block", marginTop: 5, color: "#7f8aa5", fontSize: 10 }}>
              EduSphere fee: 5% of seller earnings (seller-paid)
            </span>
          </div>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => onCheckout(paymentMethod, shippingAddress)}
            disabled={busy || cart.items.length === 0}
          >
            <WalletCards size={16} />
            {busy
              ? "Processing..."
              : paymentMethod === "COD"
                ? "Place COD Order"
                : "Pay Online with Cashfree"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketplaceOrders({
  orders,
}: {
  orders: MarketplaceOrdersResponse | null;
}) {
  if (!orders) {
    return (
      <div style={styles.timetableEmpty}>
        <Package size={30} />
        <h3 style={styles.timetableEmptyTitle}>No order data loaded</h3>
        <p style={styles.timetableEmptyText}>
          Open Orders from the Marketplace to load your purchase history.
        </p>
      </div>
    );
  }

  if (!orders.orders.length) {
    return (
      <div style={styles.timetableEmpty}>
        <Package size={30} />
        <h3 style={styles.timetableEmptyTitle}>No purchases yet</h3>
        <p style={styles.timetableEmptyText}>
          Your confirmed and pending marketplace orders will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.orderList}>
      {orders.orders.map((order) => {
        const digitalFiles = order.digital_files || [];
        const canDownload = ["CONFIRMED", "PROCESSING", "COMPLETED"].includes(
          order.status
        );

        return (
          <div key={order.order_id} style={styles.orderRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.cardEyebrow}>ORDER #{order.order_id}</span>
              <strong style={styles.orderTitle}>
                ₹{Number(order.total_amount).toFixed(2)}
              </strong>
              <span style={styles.orderDate}>
                {formatMarketplaceDate(order.created_at)}
              </span>
              <span style={{ display: "block", marginTop: 5, color: "#94a3b8", fontSize: 11 }}>
                Payment: {order.payment_method || "ONLINE"} · {order.payment_status || (order.status === "CONFIRMED" ? "PAID" : "PENDING")}
              </span>

              {canDownload && digitalFiles.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <span
                    style={{
                      color: "#a5b4fc",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                    }}
                  >
                    DIGITAL FILES — READY TO DOWNLOAD
                  </span>
                  {digitalFiles.map((file) => (
                    <a
                      key={file.attachment_id}
                      href={`${API_BASE_URL}/marketplace/attachments/${file.attachment_id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        width: "fit-content",
                        maxWidth: "100%",
                        border: "1px solid #334155",
                        borderRadius: 9,
                        padding: "8px 11px",
                        background: "#0f172a",
                        color: "#e2e8f0",
                        textDecoration: "none",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <Download size={14} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Download {file.file_name}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {canDownload && digitalFiles.length === 0 && (
                <span
                  style={{
                    display: "block",
                    marginTop: 10,
                    color: "#94a3b8",
                    fontSize: 11,
                  }}
                >
                  Digital file is not available yet.
                </span>
              )}
            </div>

            <span style={getMarketplaceStatusStyle(order.status)}>
              {order.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarketplaceSales({
  orders,
}: {
  orders: SellerOrdersResponse | null;
}) {
  if (!orders) {
    return (
      <div style={styles.timetableEmpty}>
        <WalletCards size={30} />
        <h3 style={styles.timetableEmptyTitle}>No sales data loaded</h3>
        <p style={styles.timetableEmptyText}>
          Open My Sales from the Marketplace to load your seller activity.
        </p>
      </div>
    );
  }

  if (!orders.orders.length) {
    return (
      <div style={styles.timetableEmpty}>
        <WalletCards size={30} />
        <h3 style={styles.timetableEmptyTitle}>No sales yet</h3>
        <p style={styles.timetableEmptyText}>
          Purchases of your products will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.orderList}>
      {orders.orders.map((order) => (
        <div key={order.order_item_id} style={styles.orderRow}>
          <div>
            <span style={styles.cardEyebrow}>
              ORDER #{order.order_id}
            </span>
            <strong style={styles.orderTitle}>
              {order.product_name}
            </strong>
            <span style={styles.orderDate}>
              {order.quantity} × ₹{Number(order.unit_price).toFixed(2)}
              {" · "}
              Buyer: {order.buyer_name || "Buyer"}
            </span>
          </div>

          <span style={getMarketplaceStatusStyle(order.order_status)}>
            {order.order_status}
          </span>
        </div>
      ))}
    </div>
  );
}

function MarketplaceProductForm({
  institutionId,
  onClose,
  onCreated,
}: {
  institutionId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] =
    useState<"DIGITAL" | "PHYSICAL">("PHYSICAL");
  const [conditionType, setConditionType] = useState("USED");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");

    try {
      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);

      if (!name.trim()) throw new Error("Product name is required.");
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new Error("Enter a valid non-negative price.");
      }
      if (!Number.isInteger(numericQuantity) || numericQuantity < 0) {
        throw new Error("Enter a valid non-negative quantity.");
      }

      if (!previewFile) {
        throw new Error("A preview photo is required for every marketplace listing.");
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(previewFile.type)) {
        throw new Error("Preview photo must be JPG, PNG or WEBP.");
      }

      if (previewFile.size > 5 * 1024 * 1024) {
        throw new Error("Preview photo cannot exceed 5 MB.");
      }

      if (productType === "DIGITAL") {
        if (!file) {
          throw new Error(
            "A digital product requires a downloadable file."
          );
        }
      }

      const createResponse = await fetch(`${API_BASE_URL}/marketplace/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          institution_id: institutionId,
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          product_type: productType,
          condition_type:
            productType === "DIGITAL" ? "DIGITAL" : conditionType,
          price: numericPrice,
          quantity: numericQuantity,
        }),
      });

      const createData = await createResponse.json().catch(() => null);

      if (!createResponse.ok) {
        throw new Error(
          String(
            createData?.detail ||
              createData?.message ||
              "Unable to create listing."
          )
        );
      }

      const productId = Number(createData?.product_id);

      if (productType === "DIGITAL") {
        if (!Number.isFinite(productId)) {
          throw new Error(
            "Product was created but no product ID was returned."
          );
        }

        const formData = new FormData();
        formData.append("file", file as File);

        const uploadResponse = await fetch(
          `${API_BASE_URL}/marketplace/${productId}/attachments`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok) {
          throw new Error(
            String(
              uploadData?.detail ||
                uploadData?.message ||
                "Product created but file upload failed."
            )
          );
        }
      }

      if (!Number.isFinite(productId)) {
        throw new Error("Product was created but no product ID was returned.");
      }

      const previewForm = new FormData();
      previewForm.append("file", previewFile as File);

      const previewResponse = await fetch(
        `${API_BASE_URL}/marketplace/${productId}/preview`,
        {
          method: "POST",
          credentials: "include",
          body: previewForm,
        }
      );

      const previewData = await previewResponse.json().catch(() => null);
      if (!previewResponse.ok) {
        throw new Error(
          String(
            previewData?.detail ||
              previewData?.message ||
              "Product created but preview photo upload failed."
          )
        );
      }

      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create marketplace listing."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.eventModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>SELLER</span>
            <h2 style={styles.modalTitle}>Create Listing</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.formBody}>
          {error && <div style={styles.formError}>{error}</div>}

          <label style={styles.formLabel}>
            Product name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={styles.formInput}
              placeholder="e.g. Engineering drawing set"
            />
          </label>

          <label style={styles.formLabel}>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={styles.formTextarea}
              placeholder="Describe the product..."
              rows={4}
            />
          </label>

          <div style={styles.formTwoColumn}>
            <label style={styles.formLabel}>
              Category
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                style={styles.formInput}
                placeholder="Books, Notes, Electronics..."
              />
            </label>

            <label style={styles.formLabel}>
              Product type
              <select
                value={productType}
                onChange={(event) => {
                  const value = event.target.value as
                    | "DIGITAL"
                    | "PHYSICAL";
                  setProductType(value);
                  if (value === "DIGITAL") {
                    setConditionType("DIGITAL");
                  } else if (conditionType === "DIGITAL") {
                    setConditionType("USED");
                  }
                }}
                style={styles.formInput}
              >
                <option value="PHYSICAL">Physical</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>
          </div>

          <div style={styles.formTwoColumn}>
            <label style={styles.formLabel}>
              Condition
              <select
                value={conditionType}
                onChange={(event) => setConditionType(event.target.value)}
                disabled={productType === "DIGITAL"}
                style={styles.formInput}
              >
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="DIGITAL">Digital</option>
              </select>
            </label>

            <label style={styles.formLabel}>
              Price (INR)
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                style={styles.formInput}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </label>
          </div>

          <label style={styles.formLabel}>
            Quantity
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              style={styles.formInput}
              type="number"
              min="0"
              step="1"
            />
          </label>

                    <label style={styles.fileDrop}>
            <Upload size={20} />
            <strong>Preview photo</strong>
            <span>JPG, PNG or WEBP · max 5 MB · required</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setPreviewFile(event.target.files?.[0] ?? null)
              }
              style={{ display: "none" }}
            />
            {previewFile && (
              <small style={styles.selectedFileName}>
                Selected: {previewFile.name}
              </small>
            )}
          </label>

{productType === "DIGITAL" && (
            <label style={styles.fileDrop}>
              <Upload size={20} />
              <strong>Digital file</strong>
              <span>
                PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP or TXT · max 10 MB
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                style={{ display: "none" }}
              />
              {file && (
                <small style={styles.selectedFileName}>
                  Selected: {file.name}
                </small>
              )}
            </label>
          )}
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Creating..." : "Create Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMarketplaceDate(value: string) {
  if (!value) return value;

  /*
   * Marketplace timestamps from the backend/database can arrive without
   * a timezone suffix, for example:
   *   2026-09-18 13:59:00
   *
   * These timestamps are stored/returned as UTC by the marketplace backend.
   * Normalize timezone-naive timestamps to UTC first, then always display
   * them explicitly in Indian Standard Time (Asia/Kolkata).
   */
  const raw = String(value).trim();

  const hasTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);

  const normalized =
    !hasTimezone &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMarketplaceStatusStyle(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "CONFIRMED" || normalized === "PAID") {
    return {
      ...styles.marketplaceStatus,
      color: "#67e8f9",
      background: "rgba(34,211,238,0.08)",
    };
  }

  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return {
      ...styles.marketplaceStatus,
      color: "#fda4af",
      background: "rgba(244,63,94,0.08)",
    };
  }

  return {
    ...styles.marketplaceStatus,
    color: "#fcd34d",
    background: "rgba(245,158,11,0.08)",
  };
}

/* =============================================================
   EVENTS VIEW
============================================================= */

function EventsView({
  events,
  loading,
  error,
  search,
  onSearchChange,
  onRefresh,
  onSelectEvent,
}: {
  events: EventsResponse | null;
  loading: boolean;
  error: string;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onSelectEvent: (event: StudentEvent) => void;
}) {
  const list = events?.events ?? [];
  const query = search.trim().toLowerCase();

  const filtered = query
    ? list.filter((event) => {
        const haystack = [
          event.title,
          event.description,
          event.event_type,
          event.venue,
          event.organizer,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
    : list;

  return (
    <section>
      <div style={styles.timetableHeader} className="edusphere-timetable-header">
        <div>
          <span style={styles.eyebrow}>CAMPUS CALENDAR</span>
          <h2 style={styles.timetableTitle}>Events</h2>
          <p style={styles.timetableDescription}>
            Published events available to your academic profile.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div style={styles.courseToolbar}>
        <div style={styles.courseSearchBox}>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search events, venue, organizer..."
            style={styles.courseSearchInput}
          />
        </div>

        <div style={styles.courseCountBadge}>
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </div>
      </div>

      {error ? (
        <div style={styles.timetableError}>
          <div style={styles.errorIcon}>!</div>
          <div>
            <strong>Events unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && !events ? (
        <div style={styles.timetableEmpty}>
          <RefreshCw size={28} style={styles.timetableSpinner} />
          <span style={styles.cardEyebrow}>LIVE CAMPUS DATA</span>
          <h3>Loading events</h3>
          <p>Synchronizing published events for your profile...</p>
        </div>
      ) : !events || list.length === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <CalendarDays size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO PUBLISHED EVENTS</span>
          <h3 style={styles.timetableEmptyTitle}>Nothing scheduled</h3>
          <p style={styles.timetableEmptyText}>
            There are currently no published events visible to your academic
            profile.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <Search size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO MATCHES</span>
          <h3 style={styles.timetableEmptyTitle}>No matching events</h3>
          <p style={styles.timetableEmptyText}>
            Try another event name, venue, organizer, or event type.
          </p>
        </div>
      ) : (
        <div style={styles.eventGrid} className="edusphere-event-grid">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => onSelectEvent(event)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({
  event,
  onClick,
}: {
  event: StudentEvent;
  onClick: () => void;
}) {
  const start = parseEventDate(event.start_datetime);
  const end = parseEventDate(event.end_datetime);

  return (
    <button type="button" style={styles.eventCard} onClick={onClick}>
      <div style={styles.eventDateBlock}>
        <span style={styles.eventMonth}>
          {start
            ? start.toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              month: "short",
            }).toUpperCase()
            : "DATE"}
        </span>
        <strong style={styles.eventDay}>
          {start ? start.getDate() : "—"}
        </strong>
        <span style={styles.eventWeekday}>
          {start
            ? start.toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "short",
            }).toUpperCase()
            : ""}
        </span>
      </div>

      <div style={styles.eventCardBody}>
        <div style={styles.eventCardTop}>
          <span style={styles.eventTypeBadge}>
            {event.event_type || "CAMPUS EVENT"}
          </span>
          {isUpcomingEvent(event) && (
            <span style={styles.upcomingBadge}>UPCOMING</span>
          )}
        </div>

        <h3 style={styles.eventTitle}>{event.title}</h3>

        {event.description && (
          <p style={styles.eventDescription}>
            {event.description.length > 150
              ? `${event.description.slice(0, 150)}…`
              : event.description}
          </p>
        )}

        <div style={styles.eventMetaList}>
          <div style={styles.eventMetaRow}>
            <Clock3 size={14} />
            <span>
              {formatEventTime(start)}
              {end ? ` – ${formatEventTime(end)}` : ""}
            </span>
          </div>

          {event.venue && (
            <div style={styles.eventMetaRow}>
              <MapPin size={14} />
              <span>{event.venue}</span>
            </div>
          )}

          {event.organizer && (
            <div style={styles.eventMetaRow}>
              <Users size={14} />
              <span>{event.organizer}</span>
            </div>
          )}
        </div>

        <div style={styles.eventCardFooter}>
          <span>VIEW DETAILS</span>
          <ArrowRight size={15} />
        </div>
      </div>
    </button>
  );
}

function EventDetailModal({
  event,
  onClose,
}: {
  event: StudentEvent;
  onClose: () => void;
}) {
  const start = parseEventDate(event.start_datetime);
  const end = parseEventDate(event.end_datetime);
  const deadline = parseEventDate(event.registration_deadline);

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={styles.eventModal}
        onClick={(eventClick) => eventClick.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.cardEyebrow}>
              {event.event_type || "CAMPUS EVENT"}
            </span>
            <h2 style={styles.modalTitle}>{event.title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.modalCloseButton}
            aria-label="Close event details"
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.modalBody}>
          {event.description && (
            <p style={styles.modalDescription}>{event.description}</p>
          )}

          <div style={styles.modalInfoGrid}>
            <div style={styles.modalInfoCard}>
              <CalendarDays size={17} />
              <div>
                <span style={styles.modalInfoLabel}>DATE</span>
                <strong style={styles.modalInfoValue}>
                  {start
                    ? start.toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Date unavailable"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Clock3 size={17} />
              <div>
                <span style={styles.modalInfoLabel}>TIME</span>
                <strong style={styles.modalInfoValue}>
                  {formatEventTime(start)}
                  {end ? ` – ${formatEventTime(end)}` : ""}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <MapPin size={17} />
              <div>
                <span style={styles.modalInfoLabel}>VENUE</span>
                <strong style={styles.modalInfoValue}>
                  {event.venue || "Venue not specified"}
                </strong>
              </div>
            </div>

            <div style={styles.modalInfoCard}>
              <Users size={17} />
              <div>
                <span style={styles.modalInfoLabel}>ORGANIZER</span>
                <strong style={styles.modalInfoValue}>
                  {event.organizer || "Organizer not specified"}
                </strong>
              </div>
            </div>
          </div>

          {deadline && (
            <div style={styles.registrationDeadline}>
              <Ticket size={17} />
              <div>
                <span style={styles.modalInfoLabel}>REGISTRATION DEADLINE</span>
                <strong style={styles.modalInfoValue}>
                  {deadline.toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </div>
            </div>
          )}
        </div>

        <div style={styles.modalFooter}>
          {event.registration_link ? (
            <a
              href={event.registration_link}
              target="_blank"
              rel="noreferrer"
              style={styles.registrationButton}
            >
              <ExternalLink size={16} />
              Register / Open Link
            </a>
          ) : (
            <span style={styles.noRegistration}>
              Registration link not provided
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function parseEventDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  const normalized = value.replace(" ", "T");
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatEventTime(date: Date | null) {
  if (!date) return "Time unavailable";

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcomingEvent(event: StudentEvent) {
  const start = parseEventDate(event.start_datetime);
  return Boolean(start && start.getTime() >= Date.now());
}

/* =============================================================
   COURSES VIEW
============================================================= */

function CoursesView({
  timetable,
  loading,
  error,
  search,
  onSearchChange,
  onRefresh,
}: {
  timetable: TimetableResponse | null;
  loading: boolean;
  error: string;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
}) {
  const entries = timetable?.timetable ?? [];

  const courseMap = new Map<number, StudentCourse>();

  for (const entry of entries) {
    const existing = courseMap.get(entry.course_id);

    if (!existing) {
      courseMap.set(entry.course_id, {
        course_id: entry.course_id,
        course_name: entry.course_name,
        course_code: entry.course_code,
        semester: entry.course_semester,
        professor_names: entry.professor_name
          ? [entry.professor_name]
          : [],
        days: [normalizeDay(entry.day ?? entry.day_of_week)],
        class_count: 1,
        rooms: entry.room ? [entry.room] : [],
      });
      continue;
    }

    existing.class_count += 1;

    const day = normalizeDay(entry.day ?? entry.day_of_week);
    if (day && !existing.days.includes(day)) {
      existing.days.push(day);
    }

    if (
      entry.professor_name &&
      !existing.professor_names.includes(entry.professor_name)
    ) {
      existing.professor_names.push(entry.professor_name);
    }

    if (entry.room && !existing.rooms.includes(entry.room)) {
      existing.rooms.push(entry.room);
    }
  }

  const courses = Array.from(courseMap.values()).sort((a, b) =>
    a.course_name.localeCompare(b.course_name)
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredCourses = normalizedSearch
    ? courses.filter(
        (course) =>
          course.course_name.toLowerCase().includes(normalizedSearch) ||
          course.course_code.toLowerCase().includes(normalizedSearch) ||
          course.professor_names.some((name) =>
            name.toLowerCase().includes(normalizedSearch)
          )
      )
    : courses;

  return (
    <section>
      <div style={styles.timetableHeader} className="edusphere-timetable-header">
        <div>
          <span style={styles.eyebrow}>ACADEMIC CATALOG</span>
          <h2 style={styles.timetableTitle}>Your Courses</h2>
          <p style={styles.timetableDescription}>
            Courses are derived from your live timetable records for the
            current academic group.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {timetable && (
        <>
          <div
            style={styles.timetableIdentity}
            className="edusphere-timetable-identity"
          >
            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>PROGRAM</span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.program_name}
              </strong>
            </div>

            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>SECTION</span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.section_name}
              </strong>
            </div>

            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>SEMESTER</span>
              <strong style={styles.timetableIdentityStrong}>
                Semester {timetable.student.semester}
              </strong>
            </div>

            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>
                ACADEMIC YEAR
              </span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.academic_year}
              </strong>
            </div>
          </div>

          <div style={styles.courseToolbar}>
            <div style={styles.courseSearchBox}>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search course, code or professor..."
                style={styles.courseSearchInput}
              />
            </div>

            <div style={styles.courseCountBadge}>
              {filteredCourses.length}{" "}
              {filteredCourses.length === 1 ? "course" : "courses"}
            </div>
          </div>
        </>
      )}

      {error ? (
        <div style={styles.timetableError}>
          <div style={styles.errorIcon}>!</div>
          <div>
            <strong>Courses unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && !timetable ? (
        <div style={styles.timetableEmpty}>
          <RefreshCw size={28} style={styles.timetableSpinner} />
          <span style={styles.cardEyebrow}>LIVE ACADEMIC DATA</span>
          <h3>Loading courses</h3>
          <p>Synchronizing your current semester courses...</p>
        </div>
      ) : !timetable || entries.length === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <BookOpen size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO COURSE DATA</span>
          <h3 style={styles.timetableEmptyTitle}>
            No courses available
          </h3>
          <p style={styles.timetableEmptyText}>
            No current-semester course records are available through your
            academic timetable.
          </p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <Search size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO MATCHES</span>
          <h3 style={styles.timetableEmptyTitle}>
            No matching courses
          </h3>
          <p style={styles.timetableEmptyText}>
            Try searching by course name, course code, or professor.
          </p>
        </div>
      ) : (
        <div style={styles.courseGrid} className="edusphere-course-grid">
          {filteredCourses.map((course) => (
            <article key={course.course_id} style={styles.courseCard}>
              <div style={styles.courseCardTop}>
                <div style={styles.courseIcon}>
                  <BookOpen size={21} />
                </div>

                <span style={styles.courseCodeBadge}>
                  {course.course_code}
                </span>
              </div>

              <span style={styles.courseSemester}>
                SEMESTER {course.semester}
              </span>

              <h3 style={styles.courseTitle}>{course.course_name}</h3>

              <div style={styles.courseMetaList}>
                <div style={styles.courseMetaRow}>
                  <Clock3 size={14} />
                  <span>
                    {course.class_count}{" "}
                    {course.class_count === 1 ? "class" : "classes"} / week
                  </span>
                </div>

                <div style={styles.courseMetaRow}>
                  <CalendarDays size={14} />
                  <span>{course.days.join(" · ")}</span>
                </div>

                <div style={styles.courseMetaRow}>
                  <UserRound size={14} />
                  <span>
                    {course.professor_names.length
                      ? course.professor_names.join(", ")
                      : "Professor not assigned"}
                  </span>
                </div>

                <div style={styles.courseMetaRow}>
                  <MapPin size={14} />
                  <span>
                    {course.rooms.length
                      ? course.rooms.join(", ")
                      : "Room not assigned"}
                  </span>
                </div>
              </div>

              <div style={styles.courseFooter}>
                <span>LIVE FROM EDUSPHERE</span>
                <span>#{course.course_id}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* =============================================================
   TIMETABLE VIEW
============================================================= */

function TimetableView({
  timetable,
  loading,
  error,
  selectedDay,
  onDayChange,
  onRefresh,
}: {
  timetable: TimetableResponse | null;
  loading: boolean;
  error: string;
  selectedDay: string;
  onDayChange: (day: string) => void;
  onRefresh: () => void;
}) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const entries = timetable?.timetable ?? [];
  const visibleEntries = selectedDay
    ? entries.filter(
        (entry) => normalizeDay(entry.day ?? entry.day_of_week) === normalizeDay(selectedDay)
      )
    : entries;

  const dayEntries = days.map((day) => ({
    day,
    entries: entries
      .filter((entry) => normalizeDay(entry.day ?? entry.day_of_week) === normalizeDay(day))
      .sort(
        (a, b) =>
          timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      ),
  }));

  const nextClass = getNextClass(entries);
  const totalMinutes = entries.reduce(
    (total, entry) => total + getDurationMinutes(entry.start_time, entry.end_time),
    0
  );

  return (
    <section>
      <div style={styles.timetableHeader} className="edusphere-timetable-header">
        <div>
          <span style={styles.eyebrow}>ACADEMIC SCHEDULE</span>
          <h2 style={styles.timetableTitle}>Your Timetable</h2>
          <p style={styles.timetableDescription}>
            Live schedule from your EduSphere academic records.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {timetable && (
        <>
          <div style={styles.timetableIdentity} className="edusphere-timetable-identity">
            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>PROGRAM</span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.program_name}
              </strong>
            </div>
            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>SECTION</span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.section_name}
              </strong>
            </div>
            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>SEMESTER</span>
              <strong style={styles.timetableIdentityStrong}>
                Semester {timetable.student.semester}
              </strong>
            </div>
            <div style={styles.identityCard}>
              <span style={styles.timetableIdentityLabel}>ACADEMIC YEAR</span>
              <strong style={styles.timetableIdentityStrong}>
                {timetable.student.academic_year}
              </strong>
            </div>
          </div>

          <div style={styles.scheduleSummary} className="edusphere-schedule-summary">
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>CLASSES</span>
              <strong style={styles.summaryValue}>{entries.length}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>SCHEDULED HOURS</span>
              <strong style={styles.summaryValue}>
                {(totalMinutes / 60).toFixed(1)}h
              </strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>NEXT CLASS</span>
              <strong style={styles.summaryValue}>
                {nextClass ? formatTime(nextClass.start_time) : "—"}
              </strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>STATUS</span>
              <strong style={styles.summaryValue}>
                {loading ? "SYNCING" : "LIVE"}
              </strong>
            </div>
          </div>
        </>
      )}

      <div style={styles.dayBar}>
        <button
          type="button"
          onClick={() => onDayChange("")}
          style={{
            ...styles.dayButton,
            ...(selectedDay === "" ? styles.dayButtonActive : {}),
          }}
        >
          All Days
        </button>

        {days.map((day) => {
          const count = entries.filter(
            (entry) => normalizeDay(entry.day ?? entry.day_of_week) === normalizeDay(day)
          ).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayChange(day)}
              style={{
                ...styles.dayButton,
                ...(selectedDay === day ? styles.dayButtonActive : {}),
              }}
            >
              <span>{day.slice(0, 3)}</span>
              {timetable && count > 0 && (
                <span style={styles.dayCount}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <div style={styles.timetableError}>
          <div style={styles.errorIcon}>!</div>
          <div>
            <strong>Timetable unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : loading && !timetable ? (
        <div style={styles.timetableEmpty}>
          <RefreshCw size={28} style={styles.timetableSpinner} />
          <span style={styles.cardEyebrow}>LIVE ACADEMIC DATA</span>
          <h3>Loading timetable</h3>
          <p>Synchronizing your academic schedule...</p>
        </div>
      ) : timetable && timetable.count === 0 ? (
        <div style={styles.timetableEmpty}>
          <div style={styles.emptyCalendarIcon}>
            <CalendarDays size={28} />
          </div>
          <span style={styles.cardEyebrow}>NO SCHEDULED CLASSES</span>
          <h3 style={styles.timetableEmptyTitle}>No timetable scheduled</h3>
          <p style={styles.timetableEmptyText}>
            There are currently no timetable entries for your academic
            section{selectedDay ? ` on ${selectedDay}` : ""}.
          </p>
          <span style={styles.emptyHint}>
            This view uses live timetable records from FastAPI + MySQL.
          </span>
        </div>
      ) : (
        <>
          {nextClass && !selectedDay && (
            <div style={styles.nextClassBanner}>
              <div style={styles.nextClassPulse} />
              <div style={styles.nextClassContent}>
                <span style={styles.nextClassEyebrow}>NEXT CLASS</span>
                <strong>{nextClass.course_name}</strong>
                <span>
                  {getEntryDay(nextClass)} · {formatTime(nextClass.start_time)}–
                  {formatTime(nextClass.end_time)}
                  {nextClass.room ? ` · ${nextClass.room}` : ""}
                </span>
              </div>
              <span style={styles.nextClassCode}>{nextClass.course_code}</span>
            </div>
          )}

          <div style={styles.weekGrid} className="edusphere-week-grid">
            {dayEntries.map(({ day, entries: daySchedule }) => {
              const isSelected = selectedDay === day;
              const hasClasses = daySchedule.length > 0;

              if (selectedDay && !isSelected) return null;

              return (
                <div
                  key={day}
                  className="edusphere-day-column"
                  style={{
                    ...styles.dayColumn,
                    ...(isSelected ? styles.dayColumnSelected : {}),
                  }}
                >
                  <div style={styles.dayColumnHeader}>
                    <div>
                      <span style={styles.dayColumnShort}>{day.slice(0, 3)}</span>
                      <strong>{day}</strong>
                    </div>
                    <span style={styles.dayColumnCount}>
                      {daySchedule.length}
                    </span>
                  </div>

                  {hasClasses ? (
                    <div style={styles.daySchedule}>
                      {daySchedule.map((entry) => {
                        const isNext =
                          nextClass?.timetable_id === entry.timetable_id;

                        return (
                          <div
                            key={entry.timetable_id}
                            className="edusphere-class-card"
                            style={{
                              ...styles.classCard,
                              ...(isNext ? styles.classCardNext : {}),
                            }}
                          >
                            <div style={styles.classTimeRow} className="edusphere-class-time">
                              <span>{formatTime(entry.start_time)}</span>
                              <span>{formatTime(entry.end_time)}</span>
                            </div>

                            <div style={styles.classAccent} />

                            <span style={styles.classCode}>
                              {entry.course_code}
                            </span>

                            <h3 style={styles.classTitle} className="edusphere-class-title">{entry.course_name}</h3>

                            <div style={styles.classMetaStack} className="edusphere-class-meta">
                              <span>
                                <CalendarDays size={12} />
                                {getDurationLabel(
                                  entry.start_time,
                                  entry.end_time
                                )}
                              </span>
                              <span>
                                <UserRound size={12} />
                                {entry.professor_name || "Professor not assigned"}
                              </span>
                              <span>
                                <BookOpen size={12} />
                                {entry.room || "Room not assigned"}
                              </span>
                            </div>

                            {isNext && (
                              <span style={styles.nextBadge}>NEXT</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={styles.noClassDay}>
                      <CalendarDays size={17} />
                      <span>No classes</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visibleEntries.length === 0 && selectedDay && (
            <div style={styles.noSelectedDay}>
              <CalendarDays size={22} />
              <span>No classes scheduled for {selectedDay}.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function getEntryDay(entry: TimetableEntry): string {
  return entry.day?.trim() || entry.day_of_week?.trim() || "";
}

function normalizeDay(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.trim().toUpperCase();

  const aliases: Record<string, string> = {
    MON: "Monday",
    MONDAY: "Monday",
    TUE: "Tuesday",
    TUES: "Tuesday",
    TUESDAY: "Tuesday",
    WED: "Wednesday",
    WEDS: "Wednesday",
    WEDNESDAY: "Wednesday",
    THU: "Thursday",
    THURS: "Thursday",
    THURSDAY: "Thursday",
    FRI: "Friday",
    FRIDAY: "Friday",
    SAT: "Saturday",
    SATURDAY: "Saturday",
    SUN: "Sunday",
    SUNDAY: "Sunday",
  };

  return aliases[normalized] ?? value.trim();
}

function timeToMinutes(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    // FastAPI/MySQL can serialize TIME values as seconds from midnight.
    if (Number.isFinite(value)) {
      if (value >= 0 && value < 86400) {
        return Math.floor(value / 60);
      }
    }
    return 0;
  }

  const normalized = String(value).trim();

  // Numeric TIME representation, e.g. 34200 = 09:30:00.
  if (/^\d+(?:\\.\d+)?$/.test(normalized)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0 && numeric < 86400) {
        return Math.floor(numeric / 60);
      }
    }
  }

  const parts = normalized.split(":");
  if (parts.length >= 2) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }

  return 0;
}

function getDurationMinutes(
  start: string | number | null,
  end: string | number | null
) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function getDurationLabel(
  start: string | number | null,
  end: string | number | null
) {
  const minutes = getDurationMinutes(start, end);
  if (!minutes) return "Duration unavailable";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getNextClass(entries: TimetableEntry[]) {
  if (!entries.length) return null;

  const dayOrder: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };

  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = [...entries]
    .map((entry) => {
      const entryDay = dayOrder[normalizeDay(getEntryDay(entry)).toLowerCase()] ?? 8;
      let distance = entryDay - currentDay;

      if (
        distance < 0 ||
        (distance === 0 &&
          timeToMinutes(entry.start_time) < currentMinutes)
      ) {
        distance += 7;
      }

      return {
        entry,
        distance,
        start: timeToMinutes(entry.start_time),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.start - b.start);

  return upcoming[0]?.entry ?? null;
}

function formatTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  const minutes = timeToMinutes(value);

  if (minutes === 0) {
    const normalized = String(value).trim();
    if (normalized !== "0" && normalized !== "00:00") return "—";
  }

  const hours = Math.floor(minutes / 60) % 24;
  const minuteValue = minutes % 60;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minuteValue).padStart(2, "0")} ${suffix}`;
}

/* =============================================================
   STYLES
============================================================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 15% 10%, rgba(99,102,241,0.13), transparent 32%), radial-gradient(circle at 85% 20%, rgba(34,211,238,0.10), transparent 28%), #050711",
    color: "#f8fafc",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "rgba(99,102,241,0.08)",
    filter: "blur(100px)",
    top: -220,
    left: 240,
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: 430,
    height: 430,
    borderRadius: "50%",
    background: "rgba(34,211,238,0.06)",
    filter: "blur(100px)",
    bottom: -180,
    right: -100,
    pointerEvents: "none",
  },

  grid: {
    position: "fixed",
    inset: 0,
    opacity: 0.12,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    maskImage:
      "linear-gradient(to bottom, black, transparent 80%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, black, transparent 80%)",
  },

  appShell: {
    minHeight: "100vh",
    display: "flex",
    position: "relative",
    zIndex: 1,
  },

  sidebar: {
    width: 250,
    minHeight: "100vh",
    padding: "28px 18px",
    boxSizing: "border-box",
    background: "rgba(7,10,22,0.82)",
    borderRight: "1px solid rgba(148,163,184,0.12)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    display: "flex",
    flexDirection: "column",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "0 10px 28px",
  },

  brandOrb: {
    width: 42,
    height: 42,
    borderRadius: 13,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(34,211,238,0.16))",
    border: "1px solid rgba(129,140,248,0.35)",
    boxShadow: "0 0 28px rgba(99,102,241,0.18)",
  },

  brandName: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  brandSubtitle: {
    color: "#64748b",
    fontSize: 9,
    letterSpacing: "0.08em",
    marginTop: 3,
  },

  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  navLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.18em",
    padding: "18px 11px 7px",
  },

  navItem: {
    width: "100%",
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
  },

  navItemActive: {
    color: "#f8fafc",
    background: "rgba(99,102,241,0.13)",
    borderColor: "rgba(129,140,248,0.18)",
    boxShadow: "inset 3px 0 0 #818cf8",
  },

  sidebarBottom: {
    marginTop: "auto",
  },

  connectionStatus: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.10)",
  },

  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#34d399",
    boxShadow: "0 0 12px rgba(52,211,153,0.8)",
  },

  connectionTitle: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.12em",
    color: "#cbd5e1",
  },

  connectionSubtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 3,
  },

  logoutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.15)",
    background: "rgba(127,29,29,0.10)",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 12,
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "38px 42px",
    boxSizing: "border-box",
    maxWidth: 1500,
    margin: "0 auto",
    width: "100%",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 30,
    marginBottom: 30,
  },

  eyebrow: {
    display: "block",
    color: "#818cf8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.20em",
    marginBottom: 9,
  },

  pageTitle: {
    margin: 0,
    fontSize: "clamp(30px, 4vw, 48px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  gradientText: {
    background:
      "linear-gradient(90deg, #a5b4fc, #67e8f9)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  pageDescription: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  headerProfile: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "9px 12px 9px 9px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.13)",
    background: "rgba(15,23,42,0.52)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 800,
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.34), rgba(34,211,238,0.18))",
    border: "1px solid rgba(129,140,248,0.3)",
  },

  headerName: {
    fontSize: 12,
    fontWeight: 700,
  },

  headerEmail: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 3,
  },

  heroCard: {
    minHeight: 230,
    borderRadius: 24,
    padding: "30px 34px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 30,
    background:
      "linear-gradient(135deg, rgba(30,41,84,0.58), rgba(15,23,42,0.66))",
    border: "1px solid rgba(129,140,248,0.20)",
    boxShadow:
      "0 25px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
    marginBottom: 18,
  },

  heroContent: {
    position: "relative",
    zIndex: 2,
  },

  cardEyebrow: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },

  heroTitle: {
    margin: "8px 0 5px",
    fontSize: "clamp(26px, 3vw, 38px)",
    letterSpacing: "-0.035em",
  },

  heroSubtitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 14,
  },

  heroMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 22,
  },

  metaPill: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.13)",
    color: "#cbd5e1",
    fontSize: 10,
  },

  heroOrb: {
    width: 170,
    height: 170,
    flexShrink: 0,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle, rgba(129,140,248,0.24), rgba(34,211,238,0.08) 42%, transparent 68%)",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow:
      "0 0 80px rgba(99,102,241,0.16), inset 0 0 45px rgba(34,211,238,0.06)",
  },

  heroOrbInner: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#a5b4fc",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.24), rgba(34,211,238,0.10))",
    border: "1px solid rgba(165,180,252,0.30)",
    boxShadow: "0 0 45px rgba(99,102,241,0.22)",
  },

  heroCube: {
  width: 260,
  height: 260,
  flexShrink: 0,
  position: "relative",
},

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  dataCard: {
    minWidth: 0,
    padding: 18,
    borderRadius: 17,
    background: "rgba(15,23,42,0.60)",
    border: "1px solid rgba(148,163,184,0.11)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  dataCardIcon: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.13)",
    marginBottom: 15,
  },

  dataCardLabel: {
    color: "#64748b",
    fontSize: 10,
    marginBottom: 6,
  },

  dataCardValue: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 18,
    marginBottom: 18,
  },

  panel: {
    padding: 23,
    borderRadius: 20,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    color: "#94a3b8",
    marginBottom: 18,
  },

  panelTitle: {
    margin: "6px 0 0",
    fontSize: 18,
    letterSpacing: "-0.025em",
    color: "#f8fafc",
  },

  infoList: {
    display: "flex",
    flexDirection: "column",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    padding: "12px 0",
    borderBottom:
      "1px solid rgba(148,163,184,0.08)",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 11,
  },

  infoValue: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "right",
    maxWidth: "65%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusBlock: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 13,
    background: "rgba(16,185,129,0.07)",
    border: "1px solid rgba(52,211,153,0.12)",
    marginBottom: 9,
  },

  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: "#6ee7b7",
    background: "rgba(16,185,129,0.12)",
    fontWeight: 800,
  },

  statusTitle: {
    color: "#d1fae5",
    fontSize: 11,
    fontWeight: 700,
  },

  statusText: {
    color: "#64748b",
    fontSize: 9,
    marginTop: 3,
  },

  modulesPanel: {
    padding: 23,
    borderRadius: 20,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  modulesDescription: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.6,
    maxWidth: 650,
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 20,
  },

  moduleCard: {
    minWidth: 0,
    width: "100%",
    border: "1px solid rgba(148,163,184,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 13,
    background: "rgba(2,6,23,0.38)",
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
    cursor: "pointer",
  },

  moduleIcon: {
    width: 35,
    height: 35,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
  },

  moduleTitle: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
  },

  moduleDescription: {
    color: "#64748b",
    fontSize: 9,
    marginTop: 3,
    lineHeight: 1.4,
  },

  moduleArrow: {
    marginLeft: "auto",
    color: "#475569",
    flexShrink: 0,
  },

  marketplaceHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  marketplaceTabs: {
    display: "flex",
    gap: 6,
    padding: 5,
    marginBottom: 16,
    overflowX: "auto",
    borderRadius: 13,
    background: "rgba(15,23,42,0.56)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  marketplaceTab: {
    border: 0,
    borderRadius: 9,
    padding: "9px 13px",
    color: "#64748b",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  marketplaceTabActive: {
    color: "#e2e8f0",
    background: "rgba(99,102,241,0.14)",
    boxShadow: "inset 0 0 0 1px rgba(129,140,248,0.12)",
  },

  marketplaceNotice: {
    marginBottom: 14,
    padding: "10px 13px",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 10,
  },

  marketplaceToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  marketplaceSelect: {
    minWidth: 145,
    padding: "11px 12px",
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(15,23,42,0.70)",
    color: "#cbd5e1",
    fontFamily: "inherit",
    fontSize: 10,
  },

  cartButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 13px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.15)",
    background: "rgba(34,211,238,0.07)",
    color: "#67e8f9",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  cartCount: {
    minWidth: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "rgba(34,211,238,0.14)",
    color: "#e0f2fe",
    fontSize: 8,
  },

  marketplaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },

  marketplaceProductCard: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.74))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.15)",
  },

  marketplaceProductMain: {
    width: "100%",
    minWidth: 0,
    padding: 18,
    textAlign: "left",
    border: 0,
    background: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    cursor: "pointer",
  },

  marketplaceProductIcon: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    marginBottom: 14,
    borderRadius: 13,
    color: "#67e8f9",
    background:
      "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(99,102,241,0.12))",
    border: "1px solid rgba(34,211,238,0.12)",
  },

  marketplaceProductBadgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 9,
  },

  marketplaceTypeBadge: {
    padding: "5px 7px",
    borderRadius: 6,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: "0.09em",
  },

  marketplaceCategoryBadge: {
    padding: "5px 7px",
    borderRadius: 6,
    color: "#64748b",
    background: "rgba(148,163,184,0.06)",
    fontSize: 7,
    fontWeight: 800,
  },

  marketplaceProductTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 17,
    lineHeight: 1.3,
  },

  marketplaceProductDescription: {
    minHeight: 46,
    margin: "0 0 13px",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.5,
  },

  marketplaceProductSeller: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
  },

  marketplaceProductBottom: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
    paddingTop: 13,
    borderTop: "1px solid rgba(148,163,184,0.08)",
  },

  marketplacePrice: {
    color: "#e0f2fe",
    fontSize: 20,
    lineHeight: 1,
  },

  marketplaceStock: {
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    textAlign: "right",
  },

  addToCartButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    margin: "0 14px 14px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.12)",
    background: "rgba(34,211,238,0.06)",
    color: "#67e8f9",
    fontFamily: "inherit",
    fontSize: 9,
    fontWeight: 800,
    cursor: "pointer",
  },

  sellPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: 24,
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.74))",
    border: "1px solid rgba(129,140,248,0.13)",
  },

  sellTitle: {
    margin: "7px 0 8px",
    color: "#f8fafc",
    fontSize: 22,
  },

  sellDescription: {
    maxWidth: 680,
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.6,
  },

  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  orderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderRadius: 14,
    background: "rgba(15,23,42,0.60)",
    border: "1px solid rgba(148,163,184,0.08)",
  },

  orderTitle: {
    display: "block",
    marginTop: 5,
    color: "#e2e8f0",
    fontSize: 14,
  },

  orderDate: {
    display: "block",
    marginTop: 5,
    color: "#64748b",
    fontSize: 9,
  },

  marketplaceStatus: {
    padding: "7px 9px",
    borderRadius: 8,
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  cartModal: {
    width: "min(760px, 100%)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(8,12,28,0.99))",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.48)",
  },

  cartBody: {
    padding: "0 20px",
    overflowY: "auto",
  },

  cartItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    padding: "14px 0",
    borderBottom: "1px solid rgba(148,163,184,0.07)",
  },

  cartItemMain: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  cartItemMainStrong: {},

  cartItemActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },

  quantityButton: {
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(15,23,42,0.65)",
    color: "#94a3b8",
    cursor: "pointer",
  },

  quantityValue: {
    minWidth: 20,
    textAlign: "center",
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 800,
  },

  removeCartButton: {
    width: 30,
    height: 30,
    display: "grid",
    placeItems: "center",
    marginLeft: 6,
    borderRadius: 8,
    border: "1px solid rgba(244,63,94,0.10)",
    background: "rgba(244,63,94,0.05)",
    color: "#fda4af",
    cursor: "pointer",
  },

  cartFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "17px 22px",
    borderTop: "1px solid rgba(148,163,184,0.09)",
  },

  cartTotal: {
    display: "block",
    marginTop: 4,
    color: "#f8fafc",
    fontSize: 23,
  },

  formBody: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
    padding: 24,
    overflowY: "auto",
    maxHeight: "65vh",
  },

  formTwoColumn: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 13,
  },

  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.06em",
  },

  formInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(2,6,23,0.50)",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 11,
  },

  formTextarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.10)",
    outline: "none",
    background: "rgba(2,6,23,0.50)",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 11,
  },

  formError: {
    padding: 11,
    borderRadius: 10,
    color: "#fda4af",
    background: "rgba(244,63,94,0.07)",
    border: "1px solid rgba(244,63,94,0.12)",
    fontSize: 10,
  },

  fileDrop: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 24,
    borderRadius: 13,
    border: "1px dashed rgba(34,211,238,0.22)",
    background: "rgba(34,211,238,0.04)",
    color: "#67e8f9",
    textAlign: "center",
    cursor: "pointer",
    fontSize: 10,
  },

  selectedFileName: {
    color: "#cbd5e1",
    fontSize: 9,
  },

  eventGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  eventCard: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    alignItems: "stretch",
    padding: 0,
    textAlign: "left",
    fontFamily: "inherit",
    color: "inherit",
    cursor: "pointer",
    overflow: "hidden",
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.80), rgba(8,12,28,0.72))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 50px rgba(0,0,0,0.16)",
  },

  eventDateBlock: {
    width: 82,
    minWidth: 82,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(99,102,241,0.15), rgba(34,211,238,0.06))",
    borderRight: "1px solid rgba(129,140,248,0.12)",
  },

  eventMonth: {
    color: "#67e8f9",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.14em",
  },

  eventDay: {
    margin: "3px 0",
    color: "#f8fafc",
    fontSize: 30,
    lineHeight: 1,
  },

  eventWeekday: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.10em",
  },

  eventCardBody: {
    minWidth: 0,
    flex: 1,
    padding: 18,
  },

  eventCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  eventTypeBadge: {
    padding: "5px 8px",
    borderRadius: 7,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.09)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  upcomingBadge: {
    padding: "5px 8px",
    borderRadius: 7,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.07)",
    border: "1px solid rgba(34,211,238,0.12)",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  eventTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 18,
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },

  eventDescription: {
    margin: "0 0 13px",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.55,
  },

  eventMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  eventMetaRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.4,
  },

  eventCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 12,
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#67e8f9",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.10em",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    background: "rgba(2,6,23,0.78)",
    backdropFilter: "blur(12px)",
  },

  eventModal: {
    width: "min(720px, 100%)",
    maxHeight: "min(760px, 90vh)",
    overflowY: "auto",
    borderRadius: 22,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(8,12,28,0.98))",
    border: "1px solid rgba(129,140,248,0.18)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.48)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    padding: 24,
    borderBottom: "1px solid rgba(148,163,184,0.09)",
  },

  modalTitle: {
    margin: "7px 0 0",
    color: "#f8fafc",
    fontSize: 25,
    lineHeight: 1.2,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.72)",
    color: "#94a3b8",
    cursor: "pointer",
  },

  modalBody: {
    padding: 24,
  },

  modalDescription: {
    margin: "0 0 22px",
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },

  modalInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  modalInfoCard: {
    display: "flex",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    background: "rgba(2,6,23,0.40)",
    border: "1px solid rgba(148,163,184,0.08)",
    color: "#67e8f9",
  },

  modalInfoLabel: {
    display: "block",
    marginBottom: 4,
    color: "#475569",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  modalInfoValue: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 10,
    lineHeight: 1.45,
  },

  registrationDeadline: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    marginTop: 12,
    padding: 14,
    borderRadius: 13,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.05)",
    border: "1px solid rgba(34,211,238,0.10)",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "17px 24px",
    borderTop: "1px solid rgba(148,163,184,0.09)",
  },

  registrationButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    color: "#e0f2fe",
    background: "rgba(34,211,238,0.10)",
    border: "1px solid rgba(34,211,238,0.16)",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 800,
  },

  noRegistration: {
    color: "#64748b",
    fontSize: 10,
  },

  courseToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  courseSearchBox: {
    flex: 1,
    minWidth: 260,
    maxWidth: 620,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 13,
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#64748b",
  },

  courseSearchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "inherit",
  },

  courseCountBadge: {
    padding: "10px 13px",
    borderRadius: 11,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.14)",
    fontSize: 11,
    fontWeight: 700,
  },

  courseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },

  courseCard: {
    minWidth: 0,
    padding: 20,
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.78), rgba(8,12,28,0.70))",
    border: "1px solid rgba(129,140,248,0.13)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 50px rgba(0,0,0,0.16)",
  },

  courseCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },

  courseIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    color: "#a5b4fc",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(34,211,238,0.08))",
    border: "1px solid rgba(129,140,248,0.18)",
  },

  courseCodeBadge: {
    padding: "6px 9px",
    borderRadius: 8,
    color: "#67e8f9",
    background: "rgba(34,211,238,0.07)",
    border: "1px solid rgba(34,211,238,0.12)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },

  courseSemester: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  courseTitle: {
    margin: "7px 0 17px",
    color: "#f8fafc",
    fontSize: 19,
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
  },

  courseMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  courseMetaRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.45,
  },

  courseFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 19,
    paddingTop: 13,
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.10em",
  },

  timetableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 22,
  },

  timetableTitle: {
    margin: "7px 0 6px",
    fontSize: "clamp(28px, 3vw, 40px)",
    letterSpacing: "-0.035em",
  },

  timetableDescription: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },

  timetableIdentity: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  timetableIdentityLabel: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
    marginBottom: 6,
  },

  timetableIdentityStrong: {
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 1.35,
  },

  dayBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    padding: 8,
    marginBottom: 18,
    borderRadius: 16,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  dayButton: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#64748b",
    padding: "9px 13px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  },

  dayButtonActive: {
    color: "#e0e7ff",
    background: "rgba(99,102,241,0.15)",
    borderColor: "rgba(129,140,248,0.24)",
    boxShadow: "0 0 20px rgba(99,102,241,0.08)",
  },

  timetableError: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 22,
    borderRadius: 20,
    background: "rgba(127,29,29,0.12)",
    border: "1px solid rgba(248,113,113,0.15)",
  },

  timetableEmpty: {
    minHeight: 330,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 30,
    boxSizing: "border-box",
    borderRadius: 22,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.11)",
  },

  emptyCalendarIcon: {
    width: 68,
    height: 68,
    display: "grid",
    placeItems: "center",
    marginBottom: 18,
    borderRadius: 20,
    color: "#a5b4fc",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.08))",
    border: "1px solid rgba(129,140,248,0.20)",
    boxShadow: "0 0 45px rgba(99,102,241,0.10)",
  },

  timetableEmptyTitle: {
    margin: "8px 0 7px",
    fontSize: 20,
  },

  timetableEmptyText: {
    maxWidth: 560,
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },

  emptyHint: {
    marginTop: 15,
    color: "#475569",
    fontSize: 9,
  },

  timetableSpinner: {
    marginBottom: 15,
    color: "#a5b4fc",
  },

  timetableList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  timetableCard: {
    display: "grid",
    gridTemplateColumns: "92px 18px minmax(0, 1fr)",
    alignItems: "stretch",
    minHeight: 125,
    borderRadius: 18,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.11)",
    overflow: "hidden",
  },

  timeColumn: {
    padding: "22px 10px 22px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 5,
  },

  timelineLine: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#818cf8",
    boxShadow: "0 0 16px rgba(129,140,248,0.8)",
    zIndex: 2,
  },

  classContent: {
    padding: "20px 22px",
    borderLeft: "1px solid rgba(148,163,184,0.08)",
  },

  classTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 7,
  },

  classDay: {
    color: "#67e8f9",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  classCode: {
    color: "#818cf8",
    fontSize: 10,
    fontWeight: 800,
  },

  classTitle: {
    margin: 0,
    color: "#f8fafc",
    fontSize: 17,
    letterSpacing: "-0.02em",
  },

  classMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px 18px",
    marginTop: 12,
    color: "#64748b",
    fontSize: 10,
  },

  identityCard: {
    minWidth: 0,
    padding: "14px 15px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  scheduleSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  summaryCard: {
    padding: "14px 15px",
    borderRadius: 14,
    background: "rgba(2,6,23,0.42)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  summaryLabel: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.14em",
    marginBottom: 7,
  },

  summaryValue: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 800,
  },

  dayCount: {
    display: "inline-grid",
    placeItems: "center",
    minWidth: 17,
    height: 17,
    padding: "0 4px",
    borderRadius: 999,
    background: "rgba(129,140,248,0.14)",
    color: "#a5b4fc",
    fontSize: 8,
  },

  nextClassBanner: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    marginBottom: 14,
    padding: "14px 16px",
    borderRadius: 16,
    background:
      "linear-gradient(100deg, rgba(99,102,241,0.13), rgba(34,211,238,0.06))",
    border: "1px solid rgba(129,140,248,0.17)",
    boxShadow: "0 0 35px rgba(99,102,241,0.07)",
  },

  nextClassPulse: {
    width: 9,
    height: 9,
    flexShrink: 0,
    borderRadius: "50%",
    background: "#67e8f9",
    boxShadow: "0 0 16px rgba(103,232,249,0.9)",
  },

  nextClassContent: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  nextClassEyebrow: {
    color: "#818cf8",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.16em",
  },

  nextClassCode: {
    marginLeft: "auto",
    color: "#67e8f9",
    fontSize: 10,
    fontWeight: 800,
  },

  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(170px, 1fr))",
    gap: 9,
    overflowX: "auto",
    paddingBottom: 5,
    alignItems: "start",
  },

  dayColumn: {
    minWidth: 170,
    minHeight: 330,
    padding: 9,
    borderRadius: 17,
    background: "rgba(15,23,42,0.48)",
    border: "1px solid rgba(148,163,184,0.09)",
  },

  dayColumnSelected: {
    borderColor: "rgba(129,140,248,0.24)",
    boxShadow: "0 0 35px rgba(99,102,241,0.06)",
  },

  dayColumnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "8px 8px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    marginBottom: 9,
  },

  dayColumnShort: {
    display: "block",
    color: "#67e8f9",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.14em",
    marginBottom: 3,
  },

  dayColumnCount: {
    display: "grid",
    placeItems: "center",
    minWidth: 24,
    height: 24,
    borderRadius: 8,
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(129,140,248,0.12)",
    fontSize: 9,
    fontWeight: 800,
  },

  daySchedule: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  classCard: {
    position: "relative",
    overflow: "hidden",
    padding: 13,
    borderRadius: 13,
    background: "rgba(2,6,23,0.50)",
    border: "1px solid rgba(148,163,184,0.09)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  classCardNext: {
    borderColor: "rgba(103,232,249,0.24)",
    boxShadow:
      "0 0 22px rgba(34,211,238,0.07), inset 0 1px 0 rgba(255,255,255,0.03)",
  },

  classTimeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 7,
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 10,
  },

  classAccent: {
    width: 26,
    height: 2,
    marginBottom: 10,
    background: "linear-gradient(90deg, #818cf8, #67e8f9)",
    boxShadow: "0 0 10px rgba(129,140,248,0.45)",
  },

  classMetaStack: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 11,
    color: "#64748b",
    fontSize: 9,
  },

  classMetaStackItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  nextBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: 11,
    padding: "4px 7px",
    borderRadius: 999,
    color: "#a5f3fc",
    background: "rgba(34,211,238,0.08)",
    border: "1px solid rgba(103,232,249,0.14)",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.12em",
  },

  noClassDay: {
    minHeight: 250,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#334155",
    fontSize: 9,
  },

  noSelectedDay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    color: "#64748b",
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(148,163,184,0.08)",
    fontSize: 10,
  },

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginTop: 8,
    padding: "18px 2px 8px",
    borderTop: "1px solid rgba(148,163,184,0.08)",
    color: "#64748b",
    fontSize: 9,
    letterSpacing: "0.04em",
  },

  footerBrand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  footerLogo: {
    width: 34,
    height: 34,
    flex: "0 0 34px",
    objectFit: "contain",
    borderRadius: "50%",
    filter:
      "drop-shadow(0 0 8px rgba(60,180,255,0.24)) drop-shadow(0 0 14px rgba(105,82,255,0.14))",
  },

  footerBrandName: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },

  footerBrandSubtitle: {
    marginTop: 3,
    color: "#475569",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.13em",
  },

  footerMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 8,
  },

  footerDivider: {
    color: "#334155",
  },

  loadingShell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },

  loadingOrb: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#a5b4fc",
    background:
      "radial-gradient(circle, rgba(99,102,241,0.24), rgba(34,211,238,0.08), transparent 70%)",
    border: "1px solid rgba(129,140,248,0.25)",
    boxShadow: "0 0 60px rgba(99,102,241,0.18)",
  },

  loadingTitle: {
    margin: "24px 0 8px",
    fontSize: 24,
  },

  loadingText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },

  loadingLine: {
    width: 180,
    height: 2,
    marginTop: 22,
    background:
      "linear-gradient(90deg, transparent, #818cf8, #67e8f9, transparent)",
    boxShadow: "0 0 18px rgba(129,140,248,0.45)",
  },

  errorShell: {
    width: "min(520px, calc(100% - 40px))",
    minHeight: 300,
    margin: "15vh auto 0",
    padding: 34,
    boxSizing: "border-box",
    borderRadius: 22,
    textAlign: "center",
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(248,113,113,0.15)",
    boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
  },

  errorIcon: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    margin: "0 auto 20px",
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.20)",
    color: "#fca5a5",
    fontSize: 24,
    fontWeight: 800,
  },

  errorTitle: {
    margin: "8px 0 10px",
    fontSize: 25,
  },

  errorText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  },

  errorActions: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 25,
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid rgba(129,140,248,0.25)",
    background: "rgba(99,102,241,0.16)",
    color: "#c7d2fe",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.13)",
    background: "rgba(15,23,42,0.72)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
};