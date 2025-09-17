import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ReactFlow, { MiniMap, Controls, Background } from "reactflow";
import "reactflow/dist/style.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// Example data (replace with your analytics JSON)
const events = [
    {
        "action": "app_opened",
        "category": "app_open",
        "label": {
            "screen_name": "MainActivity",
            "mode": "normal",
            "onBoardingStatus": "Complete"
        }
    },
    {
        "screenName": "onboarding",
        "action": "loaded",
        "category": "seller_bundle",
        "label": {
            "client_id": "",
            "monetisation_status": false,
            "customer_type": ""
        }
    },
    {
        "screenName": "onboarding",
        "action": "login_start_seen",
        "category": "listing_upload_new",
        "label": {
            "property_type": "residential",
            "service_type": "rent",
            "login_state": false,
            "screen_name": "user-login",
            "city": ""
        }
    },
    {
        "screenName": "onboarding",
        "action": "basic_opened",
        "category": "pyp",
        "label": {
            "property_type": "residential",
            "service_type": "rent",
            "login_state": false,
            "screen_name": "user-login",
            "city": ""
        }
    },
    {
        "screenName": "onboarding",
        "action": "whatsapp_post_seen",
        "category": "owner_listing",
        "label": {}
    },
    {
        "screenName": "onboarding",
        "action": "button_clicked",
        "category": "current_location",
        "label": {}
    },
    {
        "screenName": "onboarding",
        "action": "login_profile_changed",
        "category": "listing_upload_new",
        "label": {
            "profileType": "Broker"
        }
    },
    {
        "screenName": "onboarding",
        "action": "basic_broker_clicked",
        "category": "pyp",
        "label": {
            "profileType": "Broker"
        }
    },
    {
        "screenName": "onboarding",
        "action": "app_opened",
        "category": "app_open",
        "label": {
            "screen_name": "MainActivity",
            "prevState": "background",
            "mode": "normal",
            "onBoardingStatus": "Not Complete"
        }
    },
    {
        "screenName": "onboarding",
        "action": "login_basic_phone",
        "category": "listing_upload_new",
        "label": {
            "phone": "8130248705"
        }
    },
    {
        "screenName": "onboarding",
        "action": "exist_user_click",
        "category": "listing_upload_new",
        "label": {}
    },
    {
        "screenName": "onboarding",
        "action": "basic_login_clicked",
        "category": "pyp",
        "label": {}
    },
    {
        "screenName": "onboarding",
        "action": "login_basic_phone",
        "category": "listing_upload_new",
        "label": {
            "phone": "8130248705"
        }
    },
    {
        "screenName": "onboarding",
        "action": "login_basic_phone",
        "category": "listing_upload_new",
        "label": {
            "phone": "8130248705"
        }
    },
    {
        "screenName": "onboarding",
        "action": "login_with_password",
        "category": "signin",
        "label": {
            "cta": "login_with_password",
            "from": "onboarding",
            "screen": "onboarding"
        }
    },
    {
        "screenName": "onboarding",
        "action": "signin_failed",
        "category": "signin",
        "label": {
            "cta": "submit",
            "method": "password",
            "error_message": "please try again with correct credentials."
        }
    },
    {
        "screenName": "onboarding",
        "action": "login_completed",
        "category": "login",
        "label": {
            "cta": "signin"
        }
    },
    {
        "screenName": "onboarding",
        "action": "sign_in_success",
        "category": "login",
        "label": {
            "whatsapp_opt_in": "yes"
        }
    },
    {
        "screenName": "homeTab",
        "action": "Renewal_survey_viewed",
        "category": "Renewal_seller_survey1",
        "label": {}
    },
    {
        "screenName": "homeTab",
        "action": "seen",
        "category": "home_tab",
        "label": {}
    },
    {
        "screenName": "homeTab",
        "action": "open",
        "category": "dashboard",
        "label": {
            "client_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "monetisation_status": true,
            "customer_type": "Owner",
            "package_available": false
        }
    },
    {
        "screenName": "homeTab",
        "action": "owner_banner_carousel_seen",
        "category": "owner_banner_carousel",
        "label": {}
    },
    {
        "screenName": "owner_dashboard",
        "action": "seen",
        "category": "discount_carousel",
        "label": {
            "bannerType": "incomplete_payment",
            "screen": "owner_dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "seen",
        "category": "owner_dashboard_property_report_up",
        "label": {}
    },
    {
        "screenName": "owner_dashboard",
        "action": "seen",
        "category": "owner_dashboard_addon_carousel",
        "label": {
            "listing_id": "17694154",
            "bannerType": "boost_banner",
            "screen": "owner_dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "seen",
        "category": "referral_banner",
        "label": {}
    },
    {
        "screenName": "owner_dashboard",
        "action": "seen",
        "category": "listings_carousel",
        "label": {
            "screen": "owner_dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "nps_seen",
        "category": "owner_payment",
        "label": {
            "from": "Dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "nps_seen",
        "category": "owner_payment",
        "label": {
            "from": "Dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "nps_seen",
        "category": "owner_payment",
        "label": {
            "from": "Dashboard"
        }
    },
    {
        "screenName": "homeTab",
        "action": "nps_seen",
        "category": "owner_payment",
        "label": {
            "from": "Dashboard"
        }
    },
    {
        "screenName": "owner_dashboard",
        "action": "seen",
        "category": "score_card",
        "label": {
            "screen": "owner_dashboard"
        }
    },
    {
        "screenName": "owner_dashboard",
        "action": "click",
        "category": "listing_carousel",
        "label": {
            "listingId": "17694154",
            "cta": "Upgrade Now",
            "screen": "owner_dashboard",
            "from": "listing_carousel",
            "banner_type": "listing_card",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "discovery_done",
        "category": "owner_payment",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "sell",
            "screen_name": "owner_dashboard",
            "originalSource": "listing_card",
            "from": "listing_carousel",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard",
            "package_category_selected": "residential"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "package_viewed",
        "category": "owner",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "sell",
            "screen_name": "owner_dashboard",
            "originalSource": "listing_card",
            "from": "listing_carousel",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard",
            "package_category_selected": "residential"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "fomo_viewed",
        "category": "owner_discount",
        "label": {
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "tnc_seen",
        "category": "owner_payment",
        "label": {
            "user_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "screen": "ownerPackageInfo"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "hiw_seen",
        "category": "owner_payment",
        "label": {
            "user_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "screen": "ownerPackageInfo"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "benefits_seen",
        "category": "owner_payment",
        "label": {
            "user_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "screen": "ownerPackageInfo"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "faq_seen",
        "category": "owner_payment",
        "label": {
            "user_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "screen": "ownerPackageInfo"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "package_selection_done",
        "category": "owner_payment",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "rent",
            "screen_name": "owner_dashboard",
            "originalSource": "listing_card",
            "from": "listing_carousel",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard",
            "packageType": "BASIC",
            "opportunity_id": 8100001,
            "package_category_selected": "residential"
        }
    },
    {
        "screenName": "ownerPackageInfo",
        "action": "fomo_applied_180s_5per",
        "category": "owner_discount",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "rent",
            "screen_name": "owner_dashboard",
            "originalSource": "listing_card",
            "from": "listing_carousel",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard",
            "packageType": "BASIC",
            "opportunity_id": 8100001,
            "package_category_selected": "residential"
        }
    },
    {
        "screenName": "orderReview",
        "action": "orderreview_page_viewed",
        "category": "owner",
        "label": {
            "package_category_selected": "residential",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "orderReview",
        "action": "seen",
        "category": "owner_order_review_addon_carousel",
        "label": {
            "banner_name": "boost_listing"
        }
    },
    {
        "screenName": "orderReview",
        "action": "unchecked",
        "category": "owner_order_review_addon_carousel",
        "label": {
            "banner_name": "boost_listing"
        }
    },
    {
        "screenName": "orderReview",
        "action": "seen",
        "category": "owner_order_review_addon_carousel",
        "label": {
            "banner_name": "matching_buyer"
        }
    },
    {
        "screenName": "orderReview",
        "action": "unchecked",
        "category": "owner_order_review_addon_carousel",
        "label": {
            "banner_name": "matching_buyer"
        }
    },
    {
        "screenName": "orderReview",
        "action": "order_confirmation_opened",
        "category": "owner_payment",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "rent",
            "screen_name": "orderReview",
            "screen": "orderReview",
            "opportunity_id": 8100001,
            "originalSource": "listing_card",
            "from": "ownerPackageInfo",
            "package_category_selected": "residential",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "orderReview",
        "action": "payment_gateway_viewed",
        "category": "owner",
        "label": {
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "razorpay",
        "action": "order_confirmation_done",
        "category": "owner_payment",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "rent",
            "screen_name": "razorpay",
            "screen": "razorpay",
            "opportunity_id": "8100001",
            "serviceType": "RENT",
            "pkgName": "BASIC",
            "pkgAmount": "22",
            "pkgId": "2909",
            "package_id": "2909",
            "listingId": "",
            "paymentData": {
                "discountedPrice": "19",
                "payableAmount": "20",
                "payableAmountWithTax": "22",
                "discounts": [
                    {
                        "discount_type": "voucher",
                        "discount_amount": 5
                    }
                ],
                "totalDiscountAtCheckout": "-1"
            },
            "offerId": "",
            "couponCode": "",
            "voucherId": "null",
            "fomoDiscountApplied": {
                "id": 8712867,
                "amount": 5,
                "discountAmountType": "percentage"
            },
            "from": "orderReview",
            "originalSource": "listing_card",
            "package_category_selected": "residential",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    },
    {
        "screenName": "razorpay",
        "action": "payment_options_seen",
        "category": "custom_checkout",
        "label": {
            "profile_id": "4252e3e4-cbb0-45ec-aebf-63c0d0f5c82a",
            "owner_name": "Rahul chetryy",
            "phone_number": "8130248705",
            "user_type": "Owner",
            "service_type": "rent",
            "screen_name": "razorpay",
            "screen": "razorpay",
            "opportunity_id": "8100001",
            "serviceType": "RENT",
            "pkgName": "BASIC",
            "pkgAmount": "22",
            "pkgId": "2909",
            "package_id": "2909",
            "listingId": "",
            "paymentData": {
                "discountedPrice": "19",
                "payableAmount": "20",
                "payableAmountWithTax": "22",
                "discounts": [
                    {
                        "discount_type": "voucher",
                        "discount_amount": 5
                    }
                ],
                "totalDiscountAtCheckout": "-1"
            },
            "offerId": "",
            "couponCode": "",
            "voucherId": "null",
            "fomoDiscountApplied": {
                "id": 8712867,
                "amount": 5,
                "discountAmountType": "percentage"
            },
            "from": "orderReview",
            "originalSource": "listing_card",
            "package_category_selected": "residential",
            "hook_name": "listing_carousel",
            "hook_screen": "Dashboard"
        }
    }
]

export default function AnalyticsDashboard() {
  const [category, setCategory] = useState("all");
  const [hookName, setHookName] = useState("all");
  const [hookScreen, setHookScreen] = useState("all");

  // Get unique values for filters
  const categories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category))).sort(),
    []
  );
  const hookNames = useMemo(
    () => Array.from(new Set(events.map((e) => e.label?.hook_name))).filter(Boolean),
    []
  );
  const hookScreens = useMemo(
    () => Array.from(new Set(events.map((e) => e.label?.hook_screen))).filter(Boolean),
    []
  );

  // Filter events
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (hookName !== "all" && e.label?.hook_name !== hookName) return false;
      if (hookScreen !== "all" && e.label?.hook_screen !== hookScreen) return false;
      return true;
    });
  }, [category, hookName, hookScreen]);

  // Build flow chart nodes and edges
  const nodes = useMemo(() => {
    return filtered.map((e, i) => ({
      id: String(i),
      data: { label: `${e.screenName} → ${e.action}` },
      position: { x: 200 * (i % 4), y: Math.floor(i / 4) * 80 },
    }));
  }, [filtered]);

  const edges = useMemo(() => {
    return filtered.slice(0, -1).map((_, i) => ({
      id: `e${i}-${i + 1}`,
      source: String(i),
      target: String(i + 1),
      animated: true,
    }));
  }, [filtered]);

  // Summary charts data
  const categoryCounts = useMemo(() => {
    const counts = {};
    filtered.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const hookCounts = useMemo(() => {
    const counts = {};
    filtered.forEach((e) => {
      if (e.label?.hook_name) counts[e.label.hook_name] = (counts[e.label.hook_name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A020F0"];

  return (
    <div className="p-6 grid grid-cols-4 gap-4">
      {/* Filters */}
      <Card className="col-span-1">
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select onValueChange={setCategory} defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Hook Name</label>
            <Select onValueChange={setHookName} defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Select hook" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {hookNames.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Hook Screen</label>
            <Select onValueChange={setHookScreen} defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Select screen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {hookScreens.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => { setCategory("all"); setHookName("all"); setHookScreen("all"); }}>Reset</Button>
        </CardContent>
      </Card>

      <div className="col-span-3 space-y-4">
        {/* Summary Charts */}
        <div className="grid grid-cols-2 gap-4 h-64">
          <Card>
            <CardContent className="p-2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryCounts}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={hookCounts} dataKey="value" nameKey="name" outerRadius={80} label>
                    {hookCounts.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Flow chart */}
        <Card className="h-[70vh]">
          <CardContent className="p-0 h-full">
            <ReactFlow nodes={nodes} edges={edges} fitView>
              <MiniMap />
              <Controls />
              <Background gap={16} />
            </ReactFlow>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
