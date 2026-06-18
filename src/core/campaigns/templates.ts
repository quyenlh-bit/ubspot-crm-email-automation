/**
 * Built-in email templates a campaign can start from. Static (no DB) for v1.
 * `{{firstName}}` is a merge field applied per-recipient at send time.
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome",
    subject: "Chào mừng {{firstName}} đến với UrBox!",
    body:
      "Xin chào {{firstName}},\n\n" +
      "Cảm ơn bạn đã tham gia. Khám phá kho quà & voucher của chúng tôi ngay hôm nay.\n\n" +
      "— Đội ngũ UrBox",
  },
  {
    id: "promo",
    name: "Promotion",
    subject: "{{firstName}} ơi, ưu đãi đặc biệt dành cho bạn 🎁",
    body:
      "Xin chào {{firstName}},\n\n" +
      "Tuần này có ưu đãi độc quyền cho khách hàng thân thiết. Dùng mã URBOX để nhận quà.\n\n" +
      "— Đội ngũ UrBox",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    subject: "Bản tin UrBox — cập nhật mới nhất",
    body:
      "Xin chào {{firstName}},\n\n" +
      "Đây là những cập nhật và sản phẩm mới đáng chú ý trong kỳ này.\n\n" +
      "— Đội ngũ UrBox",
  },
];

export const findTemplate = (id: string): EmailTemplate | undefined =>
  EMAIL_TEMPLATES.find((t) => t.id === id);
