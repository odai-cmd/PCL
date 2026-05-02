// ✅ OPEN CART DRAWER
document.addEventListener("click", function (e) {
  if (e.target.closest(".cart-link")) {
    document.getElementById("cartDrawer")?.classList.add("active");
    document.getElementById("cartOverlay")?.classList.add("active");
    loadCart();
  }
});

// ✅ CLOSE CART DRAWER
document.getElementById("closeCart")?.addEventListener("click", () => {
  document.getElementById("cartDrawer")?.classList.remove("active");
  document.getElementById("cartOverlay")?.classList.remove("active");
});

// ✅ ADD TO CART
async function addToCart(name, price, image = "img/default.png") {
  try {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, image })
    });

    showToast(`${name} added to cart 🛒`);
    loadCart();
  } catch (err) {
    showToast("Something went wrong ❌");
  }
}

// ✅ LOAD CART
async function loadCart() {
  const res = await fetch("/api/cart");
  const cart = await res.json();   // ✅ your API returns array

  const container = document.getElementById("cartContainer");
  if (!container) return;

  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML =
      "<p style='text-align:center;font-size:18px;'>Your cart is empty 🛒</p>";
    return;
  }

  let total = 0;

  cart.forEach(item => {
    total += item.price * item.quantity;

    container.innerHTML += `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.product_name}">
        <div class="item-info">
          <div class="item-name">${item.product_name}</div>
          <div class="item-price">$${item.price}</div>
        </div>
        <div class="quantity-box">
          <button class="quantity-btn" onclick="updateQuantity(${item.id}, 'minus')">-</button>
          <span style="margin: 0 8px;">${item.quantity}</span>
          <button class="quantity-btn" onclick="updateQuantity(${item.id}, 'plus')">+</button>
        </div>
        <button class="remove-btn" onclick="removeItem(${item.id})">Remove</button>
      </div>`;
  });

  container.innerHTML += `
    <div class="total">Total: $${total.toFixed(2)}</div>
    <button class="checkout-btn">Proceed to Checkout</button>`;
}

// ✅ UPDATE QUANTITY
async function updateQuantity(id, action) {
  await fetch(`/api/cart/${id}/${action}`, { method: "PUT" });
  loadCart();
}

// ✅ REMOVE ITEM
async function removeItem(id) {
  await fetch(`/api/cart/${id}`, { method: "DELETE" });
  loadCart();
}

// ✅ TOAST
function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "#d4a047",
    color: "#111",
    padding: "12px 20px",
    borderRadius: "10px",
    fontWeight: "600",
    boxShadow: "0 0 15px rgba(0,0,0,0.4)",
    opacity: "0",
    transform: "translateY(20px)",
    transition: "all 0.4s ease",
    zIndex: "9999"
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 50);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 500);
  }, 2500);
}

// Load on page start
document.addEventListener("DOMContentLoaded", loadCart);

