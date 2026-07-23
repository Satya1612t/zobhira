"use client";

import { useEffect } from "react";
import { getAnalytics, isSupported } from "firebase/analytics";
import { firebaseApp } from "@/lib/firebase";

export default function FirebaseAnalytics() {
  useEffect(() => {
    void isSupported().then((supported) => {
      if (supported) {
        getAnalytics(firebaseApp);
      }
    });
  }, []);

  return null;
}
