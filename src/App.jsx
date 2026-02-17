import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";

const eventsSeed = [
  {
    id: "ride-01",
    type: "Ride",
    title: "Sunrise Ridge Run",
    location: "Nandi Hills",
    date: "Sat, 10 Aug",
    distance: "120 km",
    level: "Intermediate",
    organizer: "Arjun M.",
    description:
      "Early ride to the ridge with breakfast stop. Helmet and gloves mandatory.",
  },
  {
    id: "ride-02",
    type: "Ride",
    title: "Coastal Thunder",
    location: "ECR, Chennai",
    date: "Sun, 18 Aug",
    distance: "160 km",
    level: "Advanced",
    organizer: "Riya D.",
    description:
      "Fast cruising on the coast. Fuel stops pre-booked. Full riding gear required.",
  },
  {
    id: "ride-03",
    type: "Ride",
    title: "Coffee Trail",
    location: "Chikmagalur",
    date: "Sat, 24 Aug",
    distance: "90 km",
    level: "Beginner",
    organizer: "Imran S.",
    description:
      "Leisure ride into coffee estates. Ideal for new riders with safety briefing.",
  },
  {
    id: "ride-04",
    type: "Ride",
    title: "Night City Loop",
    location: "Hyderabad",
    date: "Fri, 30 Aug",
    distance: "65 km",
    level: "Beginner",
    organizer: "Keerthana P.",
    description:
      "City loop with late dinner stop. Reflective vest required.",
  },
  {
    id: "meet-01",
    type: "Get-Together",
    title: "Rebel Garage Meetup",
    location: "Indiranagar",
    date: "Sun, 11 Aug",
    distance: "-",
    level: "All",
    organizer: "Karthik J.",
    description:
      "Bike stories, mods showcase, coffee and live music.",
  },
  {
    id: "meet-02",
    type: "Get-Together",
    title: "Helmet Fit Clinic",
    location: "Koramangala",
    date: "Sat, 17 Aug",
    distance: "-",
    level: "All",
    organizer: "Rebel Crew",
    description:
      "Learn helmet sizing and safety checks with experts.",
  },
];

const accessoriesSeed = [
  {
    id: "acc-01",
    name: "Falcon Carbon Helmet",
    price: "INR 12,900",
    tag: "Helmet",
  },
  {
    id: "acc-02",
    name: "Griffin Armored Gloves",
    price: "INR 2,750",
    tag: "Gloves",
  },
  {
    id: "acc-03",
    name: "Trailguard Knee Pads",
    price: "INR 1,850",
    tag: "Pads",
  },
  {
    id: "acc-04",
    name: "Pulse Handlebar GPS",
    price: "INR 6,300",
    tag: "Gadget",
  },
  {
    id: "acc-05",
    name: "Stormproof Riding Jacket",
    price: "INR 7,990",
    tag: "Jacket",
  },
];

const questions = [
  "Bike model & engine capacity",
  "Rider experience (months/years)",
  "Emergency contact name & number",
  "Protective gear you will wear",
  "Health concerns we should know",
];

const rideLocations = [
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "Mysuru",
  "Goa",
  "Pune",
];

const rideTypes = ["Ride", "Get-Together", "Training"];
const accessoriesFilter = "Accessories";
const adminEmails = ["chubbihn@gmail.com"];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function App() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All locations");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signup");
  const [pendingAction, setPendingAction] = useState(null);
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [ownerRequests, setOwnerRequests] = useState([]);
  const [authError, setAuthError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const isAdmin = user && adminEmails.includes(user.email);
  const seenNotifications = useRef(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const eventsRef = collection(db, "events");
    const approvedQuery = query(eventsRef, where("status", "==", "approved"));
    const unsub = onSnapshot(approvedQuery, (snapshot) => {
      const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRemoteEvents(next);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setPendingEvents([]);
      return undefined;
    }
    const eventsRef = collection(db, "events");
    const pendingQuery = query(eventsRef, where("status", "==", "pending"));
    const unsub = onSnapshot(pendingQuery, (snapshot) => {
      const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPendingEvents(next);
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }
    const eventsRef = collection(db, "events");
    const pendingQuery = query(eventsRef, where("status", "==", "pending"));
    const unsub = onSnapshot(pendingQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const key = `admin-pending-${change.doc.id}`;
          if (!seenNotifications.current.has(key)) {
            setNotifications((prev) => [
              {
                id: key,
                title: "New event awaiting approval",
                detail: `${data.title || "Event"} · ${data.location || "TBD"}`,
                time: "Just now",
              },
              ...prev,
            ]);
            seenNotifications.current.add(key);
          }
        }
      });
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const requestsRef = collection(db, "eventRequests");
    const userQuery = query(requestsRef, where("userId", "==", user.uid));
    const unsub = onSnapshot(userQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified" || change.type === "added") {
          const data = change.doc.data();
          if (data.status !== "pending") {
            const key = `request-${change.doc.id}-${data.status}`;
            if (!seenNotifications.current.has(key)) {
              setNotifications((prev) => [
                {
                  id: key,
                  title:
                    data.status === "approved"
                      ? "Join request approved"
                      : "Join request rejected",
                  detail: data.eventTitle || `Event request ${data.status}`,
                  time: "Just now",
                },
                ...prev,
              ]);
              seenNotifications.current.add(key);
            }
          }
        }
      });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const requestsRef = collection(db, "eventRequests");
    const ownerQuery = query(
      requestsRef,
      where("eventOwnerId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(ownerQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const key = `owner-request-${change.doc.id}`;
          if (!seenNotifications.current.has(key)) {
            setNotifications((prev) => [
              {
                id: key,
                title: "New join request",
                detail: data.eventTitle || "Your event",
                time: "Just now",
              },
              ...prev,
            ]);
            seenNotifications.current.add(key);
          }
        }
      });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }
    const requestsRef = collection(db, "eventRequests");
    const adminQuery = query(
      requestsRef,
      where("approverRole", "==", "admin"),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(adminQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const key = `admin-request-${change.doc.id}`;
          if (!seenNotifications.current.has(key)) {
            setNotifications((prev) => [
              {
                id: key,
                title: "New join request (admin)",
                detail: data.eventTitle || "Default event",
                time: "Just now",
              },
              ...prev,
            ]);
            seenNotifications.current.add(key);
          }
        }
      });
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const eventsRef = collection(db, "events");
    const userEventsQuery = query(eventsRef, where("userId", "==", user.uid));
    const unsub = onSnapshot(userEventsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified" || change.type === "added") {
          const data = change.doc.data();
          if (data.status && data.status !== "pending") {
            const key = `event-${change.doc.id}-${data.status}`;
            if (!seenNotifications.current.has(key)) {
              setNotifications((prev) => [
                {
                  id: key,
                  title:
                    data.status === "approved"
                      ? "Event approved"
                      : "Event rejected",
                  detail: data.title || "Your event",
                  time: "Just now",
                },
                ...prev,
              ]);
              seenNotifications.current.add(key);
            }
          }
        }
      });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingRequests([]);
      return undefined;
    }
    const requestsRef = collection(db, "eventRequests");
    const pendingQuery = query(
      requestsRef,
      where("status", "==", "pending"),
      where("approverRole", "==", "admin")
    );
    const unsub = onSnapshot(pendingQuery, (snapshot) => {
      const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPendingRequests(next);
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      setOwnerRequests([]);
      return undefined;
    }
    const requestsRef = collection(db, "eventRequests");
    const pendingQuery = query(
      requestsRef,
      where("status", "==", "pending"),
      where("eventOwnerId", "==", user.uid)
    );
    const unsub = onSnapshot(pendingQuery, (snapshot) => {
      const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOwnerRequests(next);
    });
    return () => unsub();
  }, [user]);

  const openAuth = (mode, action = null) => {
    setAuthMode(mode);
    setPendingAction(action);
    setAuthError("");
    setShowAuthModal(true);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      let result;
      if (authMode === "signup") {
        result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (name) {
          await updateProfile(result.user, { displayName: name });
        }
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
        if (!result.user.displayName && result.user.email) {
          const fallbackName = result.user.email.split("@")[0];
          await updateProfile(result.user, { displayName: fallbackName });
        }
      }
      setShowAuthModal(false);
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
      return;
    }

    if (pendingAction === "create-event") {
      setShowCreateEvent(true);
    }
    if (pendingAction === "join-event") {
      setShowJoinForm(true);
      setShowLoginPrompt(false);
    }
    setPendingAction(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (!result.user.displayName && result.user.email) {
        const fallbackName = result.user.email.split("@")[0];
        await updateProfile(result.user, { displayName: fallbackName });
      }
      setShowAuthModal(false);
      if (pendingAction === "create-event") {
        setShowCreateEvent(true);
      }
      if (pendingAction === "join-event") {
        setShowJoinForm(true);
        setShowLoginPrompt(false);
      }
      setPendingAction(null);
    } catch (error) {
      setAuthError(error.message || "Google sign-in failed.");
    }
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      title: formData.get("title"),
      type: formData.get("type"),
      location: formData.get("location"),
      date: formData.get("date"),
      route: formData.get("route"),
      notes: formData.get("notes"),
      questions: questions.reduce((acc, question) => {
        acc[question] = formData.get(question);
        return acc;
      }, {}),
      organizer: user?.displayName || user?.email || "Rebel Rider",
      userId: user?.uid || null,
      createdByEmail: user?.email || null,
      status: "pending",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "events"), payload);
    setNotifications((prev) => [
      {
        id: `event-created-${Date.now()}`,
        title: "Event submitted for approval",
        detail: payload.title || "Event",
        time: "Just now",
      },
      ...prev,
    ]);
    setShowCreateEvent(false);
  };

  const handleJoinEvent = async (event) => {
    event.preventDefault();
    if (!user || !selectedEvent) {
      openAuth("login", "join-event");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const approverRole = selectedEvent.userId ? "owner" : "admin";
    await addDoc(collection(db, "eventRequests"), {
      eventId: selectedEvent.id,
      eventTitle: selectedEvent.title,
      eventOwnerId: selectedEvent.userId || null,
      approverRole,
      userId: user.uid,
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      experience: formData.get("experience"),
      emergency: formData.get("emergency"),
      style: formData.get("style"),
      status: "pending",
      createdAt: serverTimestamp(),
    });
    setNotifications((prev) => [
      {
        id: `join-request-${Date.now()}`,
        title: "Join request sent",
        detail: selectedEvent.title,
        time: "Just now",
      },
      ...prev,
    ]);
    setShowJoinForm(false);
  };

  const handleAddToCart = async (item) => {
    if (!user) {
      openAuth("signup", "cart");
      return;
    }
    await addDoc(collection(db, "cartItems"), {
      userId: user.uid,
      itemId: item.id,
      name: item.name,
      price: item.price,
      tag: item.tag,
      createdAt: serverTimestamp(),
    });
  };

  const handleReviewEvent = async (eventId, status) => {
    const eventRef = doc(db, "events", eventId);
    await updateDoc(eventRef, {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: user?.email || "admin",
    });
    setNotifications((prev) => [
      {
        id: `event-${eventId}-${status}-${Date.now()}`,
        title: `Event ${status}`,
        detail: status === "approved" ? "Published to landing page" : "Rejected",
        time: "Just now",
      },
      ...prev,
    ]);
  };

  const handleReviewRequest = async (requestId, status) => {
    const requestRef = doc(db, "eventRequests", requestId);
    await updateDoc(requestRef, {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: user?.email || "admin",
    });
    setNotifications((prev) => [
      {
        id: `request-${requestId}-${status}-${Date.now()}`,
        title: `Join request ${status}`,
        detail: status === "approved" ? "Rider approved" : "Rider rejected",
        time: "Just now",
      },
      ...prev,
    ]);
  };

  const mergedEvents = useMemo(
    () => [
      ...eventsSeed,
      ...remoteEvents.map((event) => ({
        ...event,
        distance: event.distance || "-",
        level: event.level || "All",
        description:
          event.description ||
          event.notes ||
          "Event created by Rebel Riders community.",
      })),
    ],
    [remoteEvents]
  );

  const eventTitleById = useMemo(
    () => new Map(mergedEvents.map((event) => [event.id, event.title])),
    [mergedEvents]
  );

  const latestRide = useMemo(() => {
    const rides = mergedEvents.filter((event) => event.type === "Ride");
    if (rides.length > 0) {
      return rides[0];
    }
    return mergedEvents[0] || null;
  }, [mergedEvents]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mergedEvents.filter((event) => {
      const matchesText =
        !term ||
        [event.title, event.location, event.type, event.organizer]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesType =
        typeFilter === "All" ? true : event.type === typeFilter;
      const matchesLocation =
        locationFilter === "All locations"
          ? true
          : event.location === locationFilter;
      return matchesText && matchesType && matchesLocation;
    });
  }, [search, typeFilter, locationFilter, mergedEvents]);

  const filteredAccessories = useMemo(() => {
    if (typeFilter !== accessoriesFilter && typeFilter !== "All") {
      return [];
    }
    const term = search.trim().toLowerCase();
    return accessoriesSeed.filter((item) =>
      [item.name, item.tag].join(" ").toLowerCase().includes(term)
    );
  }, [search, typeFilter]);

  return (
    <div className="page">
      <header className="hero">
        <nav className="nav">
          <div className="logo">
            <span>REBEL</span>
            <span className="logo-sub">RIDERS</span>
          </div>
          <div className="nav-actions">
            <button
              className="icon-btn"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z" />
              </svg>
              {notifications.length > 0 ? (
                <span className="badge">{notifications.length}</span>
              ) : null}
            </button>
            {user ? (
              <>
                <button className="ghost-btn">
                  Hi, {user.displayName || "Rider"}
                </button>
                <button className="outline-btn" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  className="ghost-btn"
                  onClick={() => openAuth("signup")}
                >
                  Join
                </button>
                <button
                  className="ghost-btn"
                  onClick={() => openAuth("signup")}
                >
                  Sign Up
                </button>
                <button
                  className="solid-btn"
                  onClick={() => openAuth("login")}
                >
                  Login
                </button>
              </>
            )}
          </div>
        </nav>
        {showNotifications ? (
          <div className="notifications">
            <div className="notifications-header">
              <h3>Notifications</h3>
              <button
                className="ghost-btn"
                onClick={() => setShowNotifications(false)}
              >
                Close
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="card-meta">No notifications yet.</p>
            ) : (
              <div className="notifications-list">
                {notifications.map((note) => (
                  <div key={note.id} className="notification-item">
                    <div>
                      <strong>{note.title}</strong>
                      <p className="card-meta">{note.detail}</p>
                    </div>
                    <span className="card-meta">{note.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">RIDE TOGETHER. RIDE LOUDER.</p>
            <h1>
              The rebel biker community for rides, meetups, and rider training.
            </h1>
            <p className="lead">
              Find upcoming ride events, get-togethers, and safety clinics. Build
              your crew, host legit events, and gear up with trusted accessories.
            </p>
            <div className="hero-cta">
              <button
                className="solid-btn"
                onClick={() =>
                  user ? setShowCreateEvent(true) : openAuth("signup", "create-event")
                }
              >
                Create an Event
              </button>
              <button className="outline-btn">Explore the Crew</button>
            </div>
            <div className="hero-stats">
              <div>
                <h3>2.4k+</h3>
                <p>Active riders</p>
              </div>
              <div>
                <h3>68</h3>
                <p>Verified events</p>
              </div>
              <div>
                <h3>15</h3>
                <p>Safety clinics</p>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-header">
              <p className="eyebrow">Next up</p>
              <h3>Upcoming highlights</h3>
            </div>
            <ul className="highlight-list">
              {mergedEvents.slice(0, 4).map((event) => (
                <li key={event.id}>
                  <span>{event.title}</span>
                  <em>{event.location}</em>
                </li>
              ))}
            </ul>
            <div className="hero-cta-row">
              <button
                className="solid-btn pulse"
                onClick={() => {
                  if (latestRide) {
                    setSelectedEvent(latestRide);
                  }
                }}
              >
                Join next ride
              </button>
              <a className="explore-link" href="#events">
                Explore more events
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="events">
        <div className="section-header">
          <div>
            <p className="eyebrow">Events & rides</p>
            <h2>Find your next rebel moment</h2>
            <p>
              Search rides, get-togethers, and training sessions posted by vetted
              organizers.
            </p>
          </div>
          <div className="filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events, locations, organizers"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All</option>
              {rideTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              <option value={accessoriesFilter}>{accessoriesFilter}</option>
            </select>
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option>All locations</option>
              {rideLocations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        {isAdmin ? (
          <div className="admin-panel">
            <h3>Admin approval queue</h3>
            <p className="card-meta">
              Approve or reject pending events before they appear on the landing
              page.
            </p>
            <div className="grid">
              {pendingEvents.length === 0 ? (
                <p className="card-meta">No pending events right now.</p>
              ) : (
                pendingEvents.map((event) => (
                  <article key={event.id} className="card admin-card">
                    <div className="card-tag">Pending</div>
                    <h3>{event.title}</h3>
                    <p className="card-meta">
                      {event.type} · {event.location} · {event.date}
                    </p>
                    <p>{event.notes || "Awaiting approval."}</p>
                    <div className="modal-actions">
                      <button
                        className="solid-btn"
                        onClick={() => handleReviewEvent(event.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="outline-btn"
                        onClick={() => handleReviewEvent(event.id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="admin-requests">
              <h3>Join requests</h3>
              <p className="card-meta">
                Review rider requests to join events.
              </p>
              <div className="grid">
                {pendingRequests.length === 0 ? (
                  <p className="card-meta">No join requests right now.</p>
                ) : (
                  pendingRequests.map((request) => (
                    <article key={request.id} className="card admin-card">
                      <div className="card-tag">Request</div>
                      <h3>{request.name}</h3>
                      <p className="card-meta">
                        {request.email} · {request.phone}
                      </p>
                      <p className="card-meta">
                        Event:{" "}
                        {request.eventTitle ||
                          eventTitleById.get(request.eventId) ||
                          request.eventId}
                      </p>
                      <div className="modal-actions">
                        <button
                          className="solid-btn"
                          onClick={() =>
                            handleReviewRequest(request.id, "approved")
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="outline-btn"
                          onClick={() =>
                            handleReviewRequest(request.id, "rejected")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {user ? (
          <div className="admin-panel">
            <h3>Your event join requests</h3>
            <p className="card-meta">
              Approve riders who want to join your events.
            </p>
            <div className="grid">
              {ownerRequests.length === 0 ? (
                <p className="card-meta">No join requests for your events.</p>
              ) : (
                ownerRequests.map((request) => (
                  <article key={request.id} className="card admin-card">
                    <div className="card-tag">Request</div>
                    <h3>{request.name}</h3>
                    <p className="card-meta">
                      {request.email} · {request.phone}
                    </p>
                    <p className="card-meta">
                      Event:{" "}
                      {request.eventTitle ||
                        eventTitleById.get(request.eventId) ||
                        request.eventId}
                    </p>
                    <div className="modal-actions">
                      <button
                        className="solid-btn"
                        onClick={() =>
                          handleReviewRequest(request.id, "approved")
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="outline-btn"
                        onClick={() =>
                          handleReviewRequest(request.id, "rejected")
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="grid">
          {filteredEvents.map((event) => (
            <article key={event.id} className="card">
              <div className="card-tag">{event.type}</div>
              <h3>{event.title}</h3>
              <p className="card-meta">
                {event.location} ? {event.date} ? {event.distance}
              </p>
              <p>{event.description}</p>
              <div className="card-footer">
                <span>{event.organizer}</span>
                <button
                  className="outline-btn"
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowJoinForm(false);
                  }}
                >
                  View details
                </button>
              </div>
            </article>
          ))}
          {filteredAccessories.map((item) => (
            <article key={item.id} className="card accessory">
              <div className="card-tag">Accessory</div>
              <h3>{item.name}</h3>
              <p className="card-meta">{item.tag}</p>
              <p className="price">{item.price}</p>
              <button className="solid-btn" onClick={() => handleAddToCart(item)}>
                Add to cart
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt" id="community">
        <div className="section-header">
          <div>
            <p className="eyebrow">Rider community</p>
            <h2>Ride along. Lead the pack.</h2>
            <p>
              Create your rider profile, connect with nearby crews, and initiate
              rides that get approved by Rebel admins.
            </p>
          </div>
        </div>
        <div className="community-grid">
          <div className="community-card">
            <h3>Join the community</h3>
            <p>
              Sign up to unlock ride invites, host events, and access exclusive
              accessory drops.
            </p>
            <button className="solid-btn" onClick={() => openAuth("signup")}>
              Create account
            </button>
          </div>
          <div className="community-card">
            <h3>Initiate a ride</h3>
            <p>
              Submit route details, safety plan, and timing. Our crew verifies
              before publishing to the main feed.
            </p>
            <button
              className="outline-btn"
              onClick={() =>
                user ? setShowCreateEvent(true) : openAuth("signup", "create-event")
              }
            >
              Start a ride
            </button>
          </div>
          <div className="community-card">
            <h3>Get together</h3>
            <p>
              Organize meetups, training camps, and community support drives.
            </p>
            <button className="ghost-btn">Host meetup</button>
          </div>
        </div>
      </section>

      <section className="section" id="accessories">
        <div className="section-header">
          <div>
            <p className="eyebrow">Accessories shop</p>
            <h2>Gear that rides with you</h2>
            <p>
              Helmets, gloves, pads, and gadgets curated for daily riders and
              long-haul crews.
            </p>
          </div>
          <div className="note">
            Cart unlocks after login or signup.
          </div>
        </div>
        <div className="grid accessories-grid">
          {accessoriesSeed.map((item) => (
            <article key={item.id} className="card accessory">
              <div className="card-tag">{item.tag}</div>
              <h3>{item.name}</h3>
              <p className="price">{item.price}</p>
              <button className="solid-btn" onClick={() => handleAddToCart(item)}>
                Add to cart
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt" id="safety">
        <div className="section-header">
          <div>
            <p className="eyebrow">Safety & training</p>
            <h2>Ride smart. Ride safe.</h2>
            <p>
              Safety briefings, training loops, and gear checklists for every
              rebel.
            </p>
          </div>
        </div>
        <div className="safety-grid">
          <div className="safety-card">
            <h3>Pre-ride briefing</h3>
            <p>
              Mandatory briefing for group rides covering signals, spacing, and
              speed zones.
            </p>
          </div>
          <div className="safety-card">
            <h3>Training rides</h3>
            <p>
              Guided sessions for beginners to build confidence on long routes.
            </p>
          </div>
          <div className="safety-card">
            <h3>Maintenance checks</h3>
            <p>
              Monthly workshops to inspect tires, brakes, and emergency kits.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="bikers">
        <div className="section-header">
          <div>
            <p className="eyebrow">Bikers page</p>
            <h2>Meet the Rebel Riders</h2>
            <p>
              Share your story, discover ride partners, and keep the community
              strong.
            </p>
          </div>
          <button className="outline-btn">View biker profiles</button>
        </div>
        <div className="biker-grid">
          <article className="biker-card">
            <h3>Ride along crew</h3>
            <p>
              Curated list of trusted riders available for city loops and
              long-distance adventures.
            </p>
            <button className="ghost-btn">Browse riders</button>
          </article>
          <article className="biker-card">
            <h3>Share your bike</h3>
            <p>
              Add your bike specs, preferred routes, and ride availability.
            </p>
            <button className="ghost-btn">Create biker card</button>
          </article>
          <article className="biker-card">
            <h3>Community guidelines</h3>
            <p>
              Respect the road, keep the pack tight, and follow the safety code.
            </p>
            <button className="ghost-btn">Read rules</button>
          </article>
        </div>
      </section>

      <footer className="footer">
        <div>
          <h3>Rebel Riders</h3>
          <p>Ride safe. Ride together. Rebel with purpose.</p>
        </div>
        <div className="footer-links">
          <a href="#events">Events</a>
          <a href="#community">Community</a>
          <a href="#accessories">Accessories</a>
          <a href="#safety">Safety</a>
        </div>
        <a
          className="insta"
          href="https://www.instagram.com/rebel.__.rider/?igsh=MW9qMjNuNjF3enpqeA%3D%3D&utm_source=qr#"
          target="_blank"
          rel="noreferrer"
        >
          <span>Instagram</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            role="img"
            focusable="false"
          >
            <path d="M16.5 3.75a3.75 3.75 0 0 1 3.75 3.75v9a3.75 3.75 0 0 1-3.75 3.75h-9a3.75 3.75 0 0 1-3.75-3.75v-9A3.75 3.75 0 0 1 7.5 3.75h9Zm0 1.5h-9A2.25 2.25 0 0 0 5.25 7.5v9A2.25 2.25 0 0 0 7.5 18.75h9A2.25 2.25 0 0 0 18.75 16.5v-9A2.25 2.25 0 0 0 16.5 5.25Zm-4.5 2.25a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.06-2.06a1.06 1.06 0 1 1 0 2.12 1.06 1.06 0 0 1 0-2.12Z" />
          </svg>
        </a>
      </footer>

      {selectedEvent ? (
        <div className="modal">
          <div className="modal-content">
            <button className="close" onClick={() => setSelectedEvent(null)}>
              Close
            </button>
            <h3>{selectedEvent.title}</h3>
            <p className="card-meta">
              {selectedEvent.location} ? {selectedEvent.date} ? {selectedEvent.level}
            </p>
            <p>{selectedEvent.description}</p>
            <div className="modal-actions">
              <button
                className="solid-btn"
                onClick={() => {
                  setShowJoinForm(true);
                  setShowLoginPrompt(!user);
                }}
              >
                I'm interested
              </button>
              <button className="outline-btn">Message organizer</button>
            </div>
          </div>
        </div>
      ) : null}

      {showJoinForm ? (
        <div className="modal">
          <div className="modal-content wide">
            <button
              className="close"
              onClick={() => {
                setShowJoinForm(false);
                setShowLoginPrompt(false);
              }}
            >
              Close
            </button>
            <h3>Join event request</h3>
            <p className="lead">
              Provide rider details. If you do not have an account, sign up or
              login to continue.
            </p>
            {showLoginPrompt ? (
              <div className="prompt">
                <p>Account required to confirm your seat.</p>
                <div>
                  <button
                    className="solid-btn"
                    onClick={() => openAuth("signup", "join-event")}
                  >
                    Create account
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => openAuth("login", "join-event")}
                  >
                    Login
                  </button>
                </div>
              </div>
            ) : null}
            <form className="form" onSubmit={handleJoinEvent}>
              <label>
                Full name
                <input name="name" placeholder="Your name" required />
              </label>
              <label>
                Email
                <input name="email" placeholder="you@email.com" required />
              </label>
              <label>
                Mobile
                <input name="phone" placeholder="+91" required />
              </label>
              <label>
                Ride experience
                <select name="experience">
                  <option>0-6 months</option>
                  <option>6-18 months</option>
                  <option>2-5 years</option>
                  <option>5+ years</option>
                </select>
              </label>
              <label>
                Emergency contact
                <input name="emergency" placeholder="Name and phone" required />
              </label>
              <label>
                Preferred ride style
                <select name="style">
                  <option>Leisure</option>
                  <option>Touring</option>
                  <option>Adventure</option>
                  <option>Track</option>
                </select>
              </label>
              <button className="solid-btn" type="submit">
                Submit request
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateEvent ? (
        <div className="modal">
          <div className="modal-content wide">
            <button className="close" onClick={() => setShowCreateEvent(false)}>
              Close
            </button>
            <h3>Create a rebel event</h3>
            <p className="lead">
              Submit your ride or meetup details. Our admins will verify and
              authorize the event before publishing.
            </p>
            <form className="form" onSubmit={handleCreateEvent}>
              <label>
                Event name
                <input name="title" placeholder="Ride name" required />
              </label>
              <label>
                Event type
                <select name="type">
                  {rideTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <select name="location">
                  {rideLocations.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </label>
              <label>
                Date & time
                <input name="date" placeholder="Sat, 14 Sep ? 5:30 AM" required />
              </label>
              <label>
                Route / meetup point
                <input name="route" placeholder="Starting point & planned stops" />
              </label>
              {questions.map((question) => (
                <label key={question}>
                  {question}
                  <input name={question} placeholder="Answer" />
                </label>
              ))}
              <label className="checkbox">
                <input name="notes" type="checkbox" value="Gear mandatory" />
                I confirm that helmets and protective gear are mandatory.
              </label>
              <button className="solid-btn" type="submit">
                Submit for approval
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showAuthModal ? (
        <div className="modal">
          <div className="modal-content auth">
            <button className="close" onClick={() => setShowAuthModal(false)}>
              Close
            </button>
            <div className="auth-header">
              <h3>{authMode === "login" ? "Login" : "Create account"}</h3>
              <p className="lead">
                {authMode === "login"
                  ? "Welcome back, rebel."
                  : "Join the Rebel Riders community."}
              </p>
            </div>
            {authError ? <p className="auth-error">{authError}</p> : null}
            <form className="form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" ? (
                <label>
                  Full name
                  <input name="name" placeholder="Your name" required />
                </label>
              ) : null}
              <label>
                Email
                <input name="email" placeholder="you@email.com" required />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                />
              </label>
              <button className="solid-btn" type="submit">
                {authMode === "login" ? "Login" : "Sign up"}
              </button>
            </form>
            <button className="outline-btn auth-provider" onClick={handleGoogleLogin}>
              Continue with Google
            </button>
            <div className="auth-switch">
              {authMode === "login" ? (
                <>
                  <span>New rider?</span>
                  <button
                    className="ghost-btn"
                    onClick={() => setAuthMode("signup")}
                  >
                    Create account
                  </button>
                </>
              ) : (
                <>
                  <span>Already have an account?</span>
                  <button
                    className="ghost-btn"
                    onClick={() => setAuthMode("login")}
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
