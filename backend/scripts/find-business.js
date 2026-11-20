require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const uid = process.env.FIREBASE_UID;

  if (!uid) throw new Error("FIREBASE_UID is missing");

  const user = await mongoose.connection
    .collection("users")
    .findOne({ firebaseUid: uid });

  if (!user) {
    console.log("STEP 1: No user found for this Firebase UID");
    return;
  }

  console.log("STEP 1: User found");
  console.log("User ID:", user._id.toString());
  console.log("Email:", user.email);
  console.log("Role:", user.role);

  const memberships = await mongoose.connection
    .collection("memberships")
    .find({ userId: user._id })
    .toArray();

  console.log("STEP 2: Memberships found:", memberships.length);

  for (const membership of memberships) {
    const business = await mongoose.connection
      .collection("businesses")
      .findOne({ _id: membership.businessId });

    console.log({
      businessId: membership.businessId.toString(),
      businessName: business?.businessName || "Business not found",
      role: membership.role,
      status: membership.status,
      isActive: membership.isActive
    });
  }
}

main()
  .catch(error => console.error("Lookup error:", error.message))
  .finally(() => mongoose.disconnect());
