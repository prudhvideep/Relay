package main

import (
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

type Server struct {
	conns map[*websocket.Conn]bool
}

func NewServer() *Server {
	return &Server{
		conns: make(map[*websocket.Conn]bool),
	}
}

func (s *Server) ReadLoop(conn *websocket.Conn) {
	for {
		_, data, err := conn.ReadMessage()

		if err != nil {
			log.Println("Conn closed ", err.Error())
			return
		}

		log.Printf("Remote addr %s\n", conn.RemoteAddr())
		log.Printf("Received - %s\n", string(data))
	}
}

func GetClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (s *Server) HandlePeerJoin(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("Error upgrading the connection ", err.Error())
		return
	}

	if _, exists := s.conns[conn]; exists {
		return
	}

	log.Println("Client ip", GetClientIP(r))

	s.conns[conn] = true

	go s.ReadLoop(conn)
}

func (s *Server) HandlePeerConns(w http.ResponseWriter, r *http.Request) {
	log.Println(s.conns)
	
}

func main() {
	s := NewServer()
	http.HandleFunc("/ws", s.HandlePeerJoin)
	http.HandleFunc("/conns", s.HandlePeerConns)

	log.Fatal(http.ListenAndServe(":6969", nil))
}
